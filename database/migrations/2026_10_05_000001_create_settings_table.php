<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Parámetros generales del sistema (p. ej. montos de la clasificación de rendimiento) y
 * permiso "settings.manage", que se otorga a los roles que ya administran roles.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value');
            $table->timestamps();
        });

        foreach (DB::table('roles')->get(['id', 'permissions']) as $role) {
            $permissions = json_decode((string) $role->permissions, true);

            if (is_array($permissions) && in_array('roles.manage', $permissions, true) && ! in_array('settings.manage', $permissions, true)) {
                $permissions[] = 'settings.manage';
                DB::table('roles')->where('id', $role->id)->update(['permissions' => json_encode(array_values($permissions))]);
            }
        }
    }

    public function down(): void
    {
        foreach (DB::table('roles')->get(['id', 'permissions']) as $role) {
            $permissions = json_decode((string) $role->permissions, true);

            if (is_array($permissions) && in_array('settings.manage', $permissions, true)) {
                DB::table('roles')->where('id', $role->id)->update([
                    'permissions' => json_encode(array_values(array_diff($permissions, ['settings.manage']))),
                ]);
            }
        }

        Schema::dropIfExists('settings');
    }
};
