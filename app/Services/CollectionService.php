<?php

namespace App\Services;

use App\Enums\LoanStatus;
use App\Enums\MachineStatus;
use App\Models\Client;
use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\Loan;
use App\Models\Machine;
use App\Models\User;
use App\Support\Money;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Registra y anula cortes aplicando las reglas de reparto con la pulpería:
 *
 * - Una máquina en pérdida normalmente no se corta: se espera a que recupere (no se envía
 *   en el corte y sus contadores no se mueven, así la pérdida se compensa sola).
 * - Si se corta a la fuerza, la pérdida se reparte con la pulpería según su comisión y se
 *   rebaja de la ganancia de sus otras máquinas en el mismo corte (se liquida el neto total).
 * - Si la parte de la pulpería queda negativa, se acumula como pérdida pendiente del cliente
 *   y se rebaja de sus próximas ganancias.
 *
 * Control antifraude: el efectivo contado en cada máquina se compara con lo teórico (neto de
 * contadores); si la diferencia supera el 15 % la observación de la máquina es obligatoria.
 * La liquidación siempre se calcula con los contadores.
 */
class CollectionService
{
    /**
     * Diferencia máxima tolerada entre efectivo contado y teórico sin exigir observación.
     */
    public const CASH_TOLERANCE = 0.15;

    /**
     * Disco privado donde se guardan fotos de contadores y firmas.
     */
    public const DISK = 'local';

    private const SIGNATURE_PREFIX = 'data:image/png;base64,';

    /**
     * @param  array{collected_on: string, notes?: string|null, signature?: string|null, loan_id?: int|null, loan_deduction?: float|string|null, items: list<array{machine_id: int, current_in: int, current_out: int, forced?: bool|string|int|null, cash_counted?: float|string|null, notes?: string|null, photo?: UploadedFile|null}>}  $data
     */
    public function record(User $user, Client $client, array $data): Collection
    {
        $signature = $this->decodeSignature($data['signature'] ?? null);

        return DB::transaction(function () use ($user, $client, $data, $signature) {
            $client = Client::query()->with('collectionRoute')->lockForUpdate()->findOrFail($client->id);

            $machines = Machine::query()
                ->whereIn('id', array_column($data['items'], 'machine_id'))
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $items = [];
            $photos = [];
            $errors = [];

            foreach ($data['items'] as $index => $row) {
                $machine = $machines->get($row['machine_id']);

                if (! $machine || $machine->client_id !== $client->id || $machine->status !== MachineStatus::Installed) {
                    $errors["items.$index.machine_id"] = 'La máquina no está instalada en este cliente.';

                    continue;
                }

                if ($row['current_in'] < $machine->counter_in) {
                    $errors["items.$index.current_in"] = "El contador no puede ser menor al anterior registrado ({$machine->counter_in}).";
                }

                if ($row['current_out'] < $machine->counter_out) {
                    $errors["items.$index.current_out"] = "El contador no puede ser menor al anterior registrado ({$machine->counter_out}).";
                }

                $creditValue = (float) $machine->credit_value;
                $amountIn = round(($row['current_in'] - $machine->counter_in) * $creditValue, 2);
                $amountOut = round(($row['current_out'] - $machine->counter_out) * $creditValue, 2);
                $net = round($amountIn - $amountOut, 2);
                $forced = filter_var($row['forced'] ?? false, FILTER_VALIDATE_BOOL);

                if ($net < 0 && ! $forced) {
                    $errors["items.$index.forced"] = "La máquina {$machine->code} está en pérdida (".Money::format($net).'): no se corta hasta que recupere, o márquela como corte forzado.';
                }

                $cash = isset($row['cash_counted']) && $row['cash_counted'] !== '' ? round((float) $row['cash_counted'], 2) : null;
                $notes = trim((string) ($row['notes'] ?? ''));

                if ($notes === '' && self::exceedsCashTolerance($net, $cash)) {
                    $errors["items.$index.notes"] = 'La diferencia entre el efectivo contado y lo teórico supera el 15 %: escriba una observación.';
                }

                $photos[$machine->id] = $row['photo'] ?? null;

                $items[] = [
                    'machine' => $machine,
                    'previous_in' => $machine->counter_in,
                    'current_in' => $row['current_in'],
                    'previous_out' => $machine->counter_out,
                    'current_out' => $row['current_out'],
                    'credit_value' => $creditValue,
                    'amount_in' => $amountIn,
                    'amount_out' => $amountOut,
                    'net' => $net,
                    'forced' => $net < 0 && $forced,
                    'cash_counted' => $cash,
                    'notes' => $notes === '' ? null : $notes,
                ];
            }

            if ($errors !== []) {
                throw ValidationException::withMessages($errors);
            }

            $totalIn = round(array_sum(array_column($items, 'amount_in')), 2);
            $totalOut = round(array_sum(array_column($items, 'amount_out')), 2);
            $net = round($totalIn - $totalOut, 2);
            $percent = (float) $client->commission_percent;
            $settlement = self::settle($net, $percent, (float) $client->loss_balance);

            [$loan, $deduction] = $this->resolveLoanDeduction($client, $data, $settlement['client_earned']);
            $clientPaid = round($settlement['client_earned'] - $deduction, 2);

            $collection = Collection::create([
                'office_id' => $client->collectionRoute->office_id,
                'collection_route_id' => $client->collection_route_id,
                'client_id' => $client->id,
                'user_id' => $user->id,
                'collected_on' => $data['collected_on'],
                'total_in' => $totalIn,
                'total_out' => $totalOut,
                'net' => $net,
                'commission_percent' => $percent,
                'client_share' => $settlement['client_share'],
                'company_share' => round($net - $settlement['client_share'], 2),
                'loss_offset' => $settlement['loss_offset'],
                'loss_added' => $settlement['loss_added'],
                'loan_deduction' => $deduction,
                'client_paid' => $clientPaid,
                // Todo lo que sale de las máquinas menos lo que se le entrega a la pulpería.
                'cash_delivered' => round($net - $clientPaid, 2),
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($items as $item) {
                $machine = $item['machine'];
                unset($item['machine']);

                $photo = $photos[$machine->id] ?? null;
                $photoPath = $photo instanceof UploadedFile
                    ? $photo->store("collections/{$collection->id}", self::DISK)
                    : null;

                $collection->items()->create([
                    'machine_id' => $machine->id,
                    ...$item,
                    'photo_path' => is_string($photoPath) ? $photoPath : null,
                ]);

                $machine->update([
                    'counter_in' => $item['current_in'],
                    'counter_out' => $item['current_out'],
                ]);
            }

            if ($signature !== null) {
                $path = "collections/{$collection->id}/firma.png";
                Storage::disk(self::DISK)->put($path, $signature);
                $collection->update(['signature_path' => $path]);
            }

            $client->update(['loss_balance' => $settlement['loss_balance']]);

            if ($loan && $deduction > 0) {
                $loan->payments()->create([
                    'collection_id' => $collection->id,
                    'user_id' => $user->id,
                    'amount' => $deduction,
                    'paid_on' => $data['collected_on'],
                    'notes' => 'Descontado de la comisión del corte #'.$collection->id,
                ]);

                $loan->refreshBalance();
            }

            return $collection;
        });
    }

    /**
     * Liquidación con la pulpería de un corte con ganancia neta $net.
     *
     * @return array{client_share: float, loss_offset: float, loss_added: float, client_earned: float, loss_balance: float}
     */
    public static function settle(float $net, float $percent, float $pendingLoss): array
    {
        // La comisión aplica igual a ganancias y pérdidas: la pulpería comparte ambas.
        $share = round($net * $percent / 100, 2);

        if ($share >= 0) {
            $offset = round(min($pendingLoss, $share), 2);

            return [
                'client_share' => $share,
                'loss_offset' => $offset,
                'loss_added' => 0.0,
                'client_earned' => round($share - $offset, 2),
                'loss_balance' => round($pendingLoss - $offset, 2),
            ];
        }

        return [
            'client_share' => $share,
            'loss_offset' => 0.0,
            'loss_added' => -$share,
            'client_earned' => 0.0,
            'loss_balance' => round($pendingLoss - $share, 2),
        ];
    }

    /**
     * Indica si el efectivo contado difiere de lo teórico (neto) más de lo tolerado.
     * Sin efectivo contado no se aplica el control.
     */
    public static function exceedsCashTolerance(float $theoretical, ?float $cash): bool
    {
        if ($cash === null) {
            return false;
        }

        $difference = round(abs($cash - $theoretical), 2);
        $base = abs($theoretical);

        if ($base === 0.0) {
            return $difference > 0;
        }

        return $difference > round($base * self::CASH_TOLERANCE, 2);
    }

    /**
     * Anula un corte restaurando contadores, la pérdida pendiente de la pulpería y el préstamo.
     */
    public function void(Collection $collection): void
    {
        $directory = "collections/{$collection->id}";

        DB::transaction(function () use ($collection) {
            $collection->load('items.machine', 'loanPayment.loan', 'client');

            foreach ($collection->items as $item) {
                $hasNewer = CollectionItem::query()
                    ->where('machine_id', $item->machine_id)
                    ->where('collection_id', '>', $collection->id)
                    ->exists();

                if ($hasNewer) {
                    throw ValidationException::withMessages([
                        'collection' => "No se puede anular: la máquina {$item->machine->code} tiene cortes posteriores.",
                    ]);
                }
            }

            // La pérdida pendiente se arrastra de corte en corte: solo se anula el último del cliente.
            $hasNewerForClient = Collection::query()
                ->where('client_id', $collection->client_id)
                ->where('id', '>', $collection->id)
                ->exists();

            if ($hasNewerForClient) {
                throw ValidationException::withMessages([
                    'collection' => 'No se puede anular: el cliente tiene cortes posteriores. Anule primero el más reciente.',
                ]);
            }

            foreach ($collection->items as $item) {
                $item->machine->update([
                    'counter_in' => $item->previous_in,
                    'counter_out' => $item->previous_out,
                ]);
            }

            $client = $collection->client;
            $client->update([
                'loss_balance' => round((float) $client->loss_balance + (float) $collection->loss_offset - (float) $collection->loss_added, 2),
            ]);

            $loan = $collection->loanPayment?->loan;

            $collection->delete();

            $loan?->refreshBalance();
        });

        // Fotos y firma del corte anulado.
        Storage::disk(self::DISK)->deleteDirectory($directory);
    }

    /**
     * Convierte la firma (data URL PNG del canvas) en binario.
     */
    private function decodeSignature(?string $dataUrl): ?string
    {
        if ($dataUrl === null || $dataUrl === '') {
            return null;
        }

        $binary = str_starts_with($dataUrl, self::SIGNATURE_PREFIX)
            ? base64_decode(substr($dataUrl, strlen(self::SIGNATURE_PREFIX)), true)
            : false;

        if ($binary === false || ! str_starts_with($binary, "\x89PNG")) {
            throw ValidationException::withMessages(['signature' => 'La firma no es válida; vuelva a firmar.']);
        }

        return $binary;
    }

    /**
     * @param  array{loan_id?: int|null, loan_deduction?: float|string|null}  $data
     * @return array{0: Loan|null, 1: float}
     */
    private function resolveLoanDeduction(Client $client, array $data, float $clientEarned): array
    {
        $deduction = round((float) ($data['loan_deduction'] ?? 0), 2);

        if ($deduction <= 0 || empty($data['loan_id'])) {
            return [null, 0.0];
        }

        $loan = Loan::query()
            ->whereKey($data['loan_id'])
            ->where('client_id', $client->id)
            ->where('status', LoanStatus::Active)
            ->lockForUpdate()
            ->first();

        if (! $loan) {
            throw ValidationException::withMessages(['loan_id' => 'El préstamo no está activo para este cliente.']);
        }

        if ($deduction > $clientEarned) {
            throw ValidationException::withMessages(['loan_deduction' => 'El descuento no puede superar la comisión a entregar a la pulpería ('.Money::format($clientEarned).').']);
        }

        if ($deduction > (float) $loan->balance) {
            throw ValidationException::withMessages(['loan_deduction' => 'El descuento no puede superar el saldo del préstamo ('.Money::format($loan->balance).').']);
        }

        return [$loan, $deduction];
    }
}
