<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Postgres no indexa las llaves foráneas automáticamente: se agregan los índices
 * que usan los filtros por alcance (oficina/ruta), el panel y los reportes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->index('office_id');
            $table->index('role_id');
        });

        Schema::table('collection_routes', function (Blueprint $table) {
            $table->index('collector_id');
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->index(['collection_route_id', 'visit_order']);
        });

        Schema::table('machines', function (Blueprint $table) {
            $table->index('client_id');
            $table->index(['office_id', 'status']);
        });

        Schema::table('collections', function (Blueprint $table) {
            $table->index(['collection_route_id', 'collected_on']);
            $table->index(['client_id', 'collected_on']);
            $table->index('user_id');
        });

        Schema::table('collection_items', function (Blueprint $table) {
            $table->index(['machine_id', 'collection_id']);
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->index(['collection_route_id', 'spent_on']);
            $table->index('user_id');
        });

        Schema::table('loans', function (Blueprint $table) {
            $table->index('client_id');
            $table->index(['office_id', 'status']);
        });

        Schema::table('loan_payments', function (Blueprint $table) {
            $table->index('loan_id');
            $table->index('collection_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->dropIndex(['office_id']);
            $t->dropIndex(['role_id']);
        });
        Schema::table('collection_routes', fn (Blueprint $t) => $t->dropIndex(['collector_id']));
        Schema::table('clients', fn (Blueprint $t) => $t->dropIndex(['collection_route_id', 'visit_order']));
        Schema::table('machines', function (Blueprint $t) {
            $t->dropIndex(['client_id']);
            $t->dropIndex(['office_id', 'status']);
        });
        Schema::table('collections', function (Blueprint $t) {
            $t->dropIndex(['collection_route_id', 'collected_on']);
            $t->dropIndex(['client_id', 'collected_on']);
            $t->dropIndex(['user_id']);
        });
        Schema::table('collection_items', fn (Blueprint $t) => $t->dropIndex(['machine_id', 'collection_id']));
        Schema::table('expenses', function (Blueprint $t) {
            $t->dropIndex(['collection_route_id', 'spent_on']);
            $t->dropIndex(['user_id']);
        });
        Schema::table('loans', function (Blueprint $t) {
            $t->dropIndex(['client_id']);
            $t->dropIndex(['office_id', 'status']);
        });
        Schema::table('loan_payments', function (Blueprint $t) {
            $t->dropIndex(['loan_id']);
            $t->dropIndex(['collection_id']);
        });
    }
};
