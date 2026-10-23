<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Historial de movimientos de máquinas en campo (transferencia entre clientes,
 * envío a bodega e instalación desde bodega) y el permiso "machines.move", que se
 * otorga a los roles existentes que ya podían administrar máquinas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('machine_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('machine_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // transfer, warehouse, install
            $table->string('type');
            $table->foreignId('from_client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignId('to_client_id')->nullable()->constrained('clients')->nullOnDelete();
            // Contadores leídos al momento del movimiento.
            $table->unsignedBigInteger('counter_in');
            $table->unsignedBigInteger('counter_out');
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->index(['machine_id', 'id']);
        });

        foreach (DB::table('roles')->get(['id', 'permissions']) as $role) {
            $permissions = json_decode((string) $role->permissions, true);

            if (is_array($permissions) && in_array('machines.manage', $permissions, true) && ! in_array('machines.move', $permissions, true)) {
                $permissions[] = 'machines.move';
                DB::table('roles')->where('id', $role->id)->update(['permissions' => json_encode(array_values($permissions))]);
            }
        }
    }

    public function down(): void
    {
        foreach (DB::table('roles')->get(['id', 'permissions']) as $role) {
            $permissions = json_decode((string) $role->permissions, true);

            if (is_array($permissions) && in_array('machines.move', $permissions, true)) {
                DB::table('roles')->where('id', $role->id)->update([
                    'permissions' => json_encode(array_values(array_diff($permissions, ['machines.move']))),
                ]);
            }
        }

        Schema::dropIfExists('machine_movements');
    }
};
