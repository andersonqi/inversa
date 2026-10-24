<?php

namespace App\Services;

use App\Models\Client;
use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\Machine;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Sincroniza cortes registrados sin conexión.
 *
 * Cada lectura trae los contadores "anteriores" que el cobrador tenía en el teléfono. Si
 * la máquina ya no tiene esos contadores es porque mientras tanto se registró otro corte
 * (o se movió la máquina): hay conflicto y el usuario decide cuál corte conservar. Para
 * quedarse con el corte sin conexión se anulan los cortes registrados en conflicto.
 *
 * @phpstan-type ConflictMachine array{machine_id: int, code: string, base_in: int, base_out: int, current_in: int, current_out: int}
 * @phpstan-type CompetingItem array{code: string, previous_in: int, current_in: int, previous_out: int, current_out: int, net: float}
 * @phpstan-type Competing array{id: int, collected_on: string, created_at: string|null, client: string, user: string, net: float, can_replace: bool, items: array<int, CompetingItem>}
 * @phpstan-type Conflict array{machines: list<ConflictMachine>, competing: array<int, Competing>}
 */
class CollectionSyncService
{
    public function __construct(private CollectionService $collections) {}

    /**
     * @param  array<string, mixed>  $data  Datos validados por SyncCollectionRequest.
     * @return array{status: 'created'|'duplicate', collection: Collection}|array{status: 'conflict', conflict: Conflict}
     */
    public function sync(User $user, Client $client, array $data): array
    {
        $existing = Collection::query()->where('offline_id', $data['offline_id'])->first();

        if ($existing) {
            return ['status' => 'duplicate', 'collection' => $existing];
        }

        /** @var list<array{machine_id: int|string, base_in: int|string, base_out: int|string}> $items */
        $items = $data['items'];

        return DB::transaction(function () use ($user, $client, $data, $items) {
            $conflict = $this->detectConflict($user, $items);

            if ($conflict !== null) {
                $ids = array_column($conflict['competing'], 'id');
                $seen = array_map('intval', (array) ($data['replace_ids'] ?? []));
                sort($ids);
                sort($seen);

                // Solo se reemplaza si el usuario vio exactamente estos cortes en el diálogo.
                if (($data['resolution'] ?? null) !== 'replace' || $ids === [] || $ids !== $seen) {
                    return ['status' => 'conflict', 'conflict' => $conflict];
                }

                foreach ($conflict['competing'] as $competing) {
                    if (! $competing['can_replace']) {
                        throw ValidationException::withMessages([
                            'resolution' => "No tiene permiso para anular el corte #{$competing['id']}; pida a un supervisor que lo anule.",
                        ]);
                    }
                }

                // Del más reciente al más antiguo: un corte solo se anula si no tiene posteriores.
                foreach (Collection::query()->whereIn('id', $ids)->orderByDesc('id')->get() as $collection) {
                    $this->collections->void($collection);
                }

                if ($this->detectConflict($user, $items) !== null) {
                    throw ValidationException::withMessages([
                        'resolution' => 'Los contadores de la máquina siguen sin coincidir con los del teléfono; revise sus cortes y movimientos.',
                    ]);
                }
            }

            return ['status' => 'created', 'collection' => $this->collections->record($user, $client, $data)];
        });
    }

    /**
     * @param  list<array{machine_id: int|string, base_in: int|string, base_out: int|string}>  $items
     * @return Conflict|null
     */
    public function detectConflict(User $user, array $items): ?array
    {
        $machines = Machine::query()
            ->whereIn('id', array_column($items, 'machine_id'))
            ->get()
            ->keyBy('id');

        $conflicting = [];

        foreach ($items as $row) {
            $machine = $machines->get((int) $row['machine_id']);

            // Máquinas inexistentes o ajenas las rechaza el registro del corte.
            if (! $machine) {
                continue;
            }

            if ($machine->counter_in !== (int) $row['base_in'] || $machine->counter_out !== (int) $row['base_out']) {
                $conflicting[] = [
                    'machine_id' => $machine->id,
                    'code' => $machine->code,
                    'base_in' => (int) $row['base_in'],
                    'base_out' => (int) $row['base_out'],
                    'current_in' => $machine->counter_in,
                    'current_out' => $machine->counter_out,
                ];
            }
        }

        if ($conflicting === []) {
            return null;
        }

        return ['machines' => $conflicting, 'competing' => $this->competing($user, $conflicting)];
    }

    /**
     * Cortes registrados después de los contadores que el teléfono tenía como anteriores.
     *
     * @param  list<ConflictMachine>  $conflicting
     * @return array<int, Competing>
     */
    private function competing(User $user, array $conflicting): array
    {
        return Collection::query()
            ->whereHas('items', function (Builder $query) use ($conflicting) {
                $query->where(function (Builder $query) use ($conflicting) {
                    foreach ($conflicting as $machine) {
                        $query->orWhere(fn (Builder $q) => $q
                            ->where('machine_id', $machine['machine_id'])
                            ->where('previous_in', '>=', $machine['base_in'])
                            ->where('previous_out', '>=', $machine['base_out'])
                            // Un corte sin movimiento no cambia los contadores.
                            ->where(fn (Builder $moved) => $moved
                                ->whereColumn('current_in', '>', 'previous_in')
                                ->orWhereColumn('current_out', '>', 'previous_out')));
                    }
                });
            })
            ->with(['user:id,name', 'client:id,name', 'items.machine:id,code'])
            ->orderBy('id')
            ->get()
            ->map(fn (Collection $collection) => [
                'id' => $collection->id,
                'collected_on' => $collection->collected_on->toDateString(),
                'created_at' => $collection->created_at?->toIso8601String(),
                'client' => $collection->client->name,
                'user' => $collection->user->name,
                'net' => (float) $collection->net,
                'can_replace' => $collection->isVisibleTo($user)
                    && ($user->can('collections.delete') || $collection->user_id === $user->id),
                'items' => $collection->items
                    ->map(fn (CollectionItem $item) => [
                        'code' => $item->machine->code,
                        'previous_in' => $item->previous_in,
                        'current_in' => $item->current_in,
                        'previous_out' => $item->previous_out,
                        'current_out' => $item->current_out,
                        'net' => (float) $item->net,
                    ])
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }
}
