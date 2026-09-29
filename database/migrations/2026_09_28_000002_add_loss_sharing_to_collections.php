<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Reparto de pérdidas con la pulpería: en un corte forzado la pérdida se reparte según
 * la comisión; si la parte de la pulpería no se cubre con la ganancia de ese corte, queda
 * pendiente en el cliente y se rebaja de sus próximas ganancias.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            // Parte de pérdidas compartidas que la pulpería aún debe compensar.
            $table->decimal('loss_balance', 14, 2)->default(0)->after('commission_percent');
        });

        Schema::table('collections', function (Blueprint $table) {
            // Pérdida pendiente rebajada de la comisión en este corte.
            $table->decimal('loss_offset', 14, 2)->default(0)->after('company_share');
            // Parte de la pérdida de este corte que queda pendiente para la pulpería.
            $table->decimal('loss_added', 14, 2)->default(0)->after('loss_offset');
            // Efectivo entregado a la pulpería.
            $table->decimal('client_paid', 14, 2)->default(0)->after('loan_deduction');
        });

        Schema::table('collection_items', function (Blueprint $table) {
            // Máquina en pérdida cortada a la fuerza.
            $table->boolean('forced')->default(false)->after('net');
        });

        DB::table('collections')->update([
            'client_paid' => DB::raw('greatest(client_share - loan_deduction, 0)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('collection_items', fn (Blueprint $table) => $table->dropColumn('forced'));
        Schema::table('collections', fn (Blueprint $table) => $table->dropColumn(['loss_offset', 'loss_added', 'client_paid']));
        Schema::table('clients', fn (Blueprint $table) => $table->dropColumn('loss_balance'));
    }
};
