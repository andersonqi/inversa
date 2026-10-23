<?php

namespace App\Services;

use App\Enums\MachineMovementType;
use App\Enums\MachineStatus;
use App\Models\Client;
use App\Models\Machine;
use App\Models\MachineMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Logística de máquinas en campo, con historial de cada movimiento.
 *
 * Una máquina instalada solo se mueve si sus contadores coinciden con el último corte:
 * lo jugado después pertenece al cliente actual y debe cortarse antes de moverla, para
 * que no se liquide al cliente nuevo.
 */
class MachineMovementService
{
    public function transfer(User $user, Machine $machine, Client $client, int $counterIn, int $counterOut, string $reason): MachineMovement
    {
        return DB::transaction(function () use ($user, $machine, $client, $counterIn, $counterOut, $reason) {
            $machine = $this->lock($machine);

            if ($machine->status !== MachineStatus::Installed || $machine->client_id === null) {
                throw ValidationException::withMessages(['client_id' => 'Solo se transfieren máquinas instaladas en un cliente.']);
            }

            if ($machine->client_id === $client->id) {
                throw ValidationException::withMessages(['client_id' => 'La máquina ya está instalada en ese cliente.']);
            }

            $this->ensureSameOffice($machine, $client);
            $this->ensureNoPendingPlays($machine, $counterIn, $counterOut);

            $from = $machine->client_id;

            $machine->update([
                'client_id' => $client->id,
                'installed_at' => now()->toDateString(),
            ]);

            return $this->record($user, $machine, MachineMovementType::Transfer, $from, $client->id, $reason);
        });
    }

    public function sendToWarehouse(User $user, Machine $machine, int $counterIn, int $counterOut, string $reason): MachineMovement
    {
        return DB::transaction(function () use ($user, $machine, $counterIn, $counterOut, $reason) {
            $machine = $this->lock($machine);

            if ($machine->client_id === null) {
                throw ValidationException::withMessages(['reason' => 'La máquina no está asignada a ningún cliente.']);
            }

            $this->ensureNoPendingPlays($machine, $counterIn, $counterOut);

            $from = $machine->client_id;

            $machine->update([
                'client_id' => null,
                'status' => MachineStatus::Warehouse,
                'installed_at' => null,
            ]);

            return $this->record($user, $machine, MachineMovementType::Warehouse, $from, null, $reason);
        });
    }

    /**
     * Instala en un cliente una máquina en bodega o mantenimiento. Los contadores leídos
     * quedan como punto de partida del próximo corte.
     */
    public function install(User $user, Machine $machine, Client $client, int $counterIn, int $counterOut, ?string $reason): MachineMovement
    {
        return DB::transaction(function () use ($user, $machine, $client, $counterIn, $counterOut, $reason) {
            $machine = $this->lock($machine);

            if (! in_array($machine->status, [MachineStatus::Warehouse, MachineStatus::Maintenance], true)) {
                throw ValidationException::withMessages(['client_id' => 'Solo se instalan máquinas que están en bodega o mantenimiento.']);
            }

            $this->ensureSameOffice($machine, $client);

            $machine->update([
                'client_id' => $client->id,
                'status' => MachineStatus::Installed,
                'installed_at' => now()->toDateString(),
                'counter_in' => $counterIn,
                'counter_out' => $counterOut,
            ]);

            return $this->record($user, $machine, MachineMovementType::Install, null, $client->id, $reason);
        });
    }

    private function lock(Machine $machine): Machine
    {
        return Machine::query()->lockForUpdate()->findOrFail($machine->id);
    }

    private function ensureSameOffice(Machine $machine, Client $client): void
    {
        $client->loadMissing('collectionRoute');

        if ($client->collectionRoute->office_id !== $machine->office_id) {
            throw ValidationException::withMessages(['client_id' => 'El cliente debe pertenecer a la oficina de la máquina.']);
        }
    }

    private function ensureNoPendingPlays(Machine $machine, int $counterIn, int $counterOut): void
    {
        $errors = [];

        foreach (['counter_in' => [$counterIn, 'entrada'], 'counter_out' => [$counterOut, 'salida']] as $field => [$read, $label]) {
            $stored = (int) $machine->getAttribute($field);

            if ($read < $stored) {
                $errors[$field] = "El contador no puede ser menor al anterior registrado ({$stored}).";
            } elseif ($read > $stored) {
                $errors[$field] = "La máquina tiene jugadas sin cortar ({$label} {$stored} → {$read}). Registre el corte en el cliente actual antes de moverla.";
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function record(User $user, Machine $machine, MachineMovementType $type, ?int $from, ?int $to, ?string $reason): MachineMovement
    {
        $reason = trim((string) $reason);

        return $machine->movements()->create([
            'user_id' => $user->id,
            'type' => $type,
            'from_client_id' => $from,
            'to_client_id' => $to,
            'counter_in' => $machine->counter_in,
            'counter_out' => $machine->counter_out,
            'reason' => $reason === '' ? null : $reason,
        ]);
    }
}
