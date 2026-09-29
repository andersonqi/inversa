<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('machines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('office_id')->constrained()->restrictOnDelete();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code')->unique();
            $table->string('serial')->nullable();
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            // Valor monetario de cada crédito de los contadores.
            $table->decimal('credit_value', 12, 2)->default(1);
            // Contadores vigentes (se actualizan con cada corte).
            $table->unsignedBigInteger('counter_in')->default(0);
            $table->unsignedBigInteger('counter_out')->default(0);
            $table->decimal('purchase_cost', 14, 2)->nullable();
            $table->date('installed_at')->nullable();
            // warehouse, installed, maintenance, retired
            $table->string('status')->default('warehouse');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('status');
        });

        // Corte / visita del cobrador a un cliente.
        Schema::create('collections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('office_id')->constrained()->restrictOnDelete();
            $table->foreignId('collection_route_id')->constrained()->restrictOnDelete();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->date('collected_on');
            $table->decimal('total_in', 14, 2)->default(0);
            $table->decimal('total_out', 14, 2)->default(0);
            $table->decimal('net', 14, 2)->default(0);
            $table->decimal('commission_percent', 5, 2)->default(0);
            $table->decimal('client_share', 14, 2)->default(0);
            $table->decimal('company_share', 14, 2)->default(0);
            // Parte de la comisión del cliente que se aplica a su préstamo.
            $table->decimal('loan_deduction', 14, 2)->default(0);
            // Efectivo que el cobrador entrega a la oficina.
            $table->decimal('cash_delivered', 14, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['collected_on', 'office_id']);
        });

        Schema::create('collection_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('collection_id')->constrained()->cascadeOnDelete();
            $table->foreignId('machine_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('previous_in');
            $table->unsignedBigInteger('current_in');
            $table->unsignedBigInteger('previous_out');
            $table->unsignedBigInteger('current_out');
            $table->decimal('credit_value', 12, 2);
            $table->decimal('amount_in', 14, 2);
            $table->decimal('amount_out', 14, 2);
            $table->decimal('net', 14, 2);
            $table->timestamps();

            $table->unique(['collection_id', 'machine_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('collection_items');
        Schema::dropIfExists('collections');
        Schema::dropIfExists('machines');
    }
};
