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
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('office_id')->constrained()->restrictOnDelete();
            $table->foreignId('collection_route_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('machine_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('category');
            $table->decimal('amount', 14, 2);
            $table->date('spent_on');
            $table->string('description')->nullable();
            $table->timestamps();

            $table->index(['spent_on', 'office_id']);
        });

        Schema::create('loans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('office_id')->constrained()->restrictOnDelete();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->decimal('principal', 14, 2);
            // Interés total (plano) sobre el capital.
            $table->decimal('interest_percent', 5, 2)->default(0);
            $table->decimal('total', 14, 2);
            $table->decimal('balance', 14, 2);
            // daily, weekly, biweekly, monthly
            $table->string('frequency');
            $table->unsignedInteger('installments');
            $table->decimal('installment_amount', 14, 2);
            $table->date('issued_on');
            $table->date('first_due_on');
            // active, paid, cancelled
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'client_id']);
        });

        Schema::create('loan_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained()->cascadeOnDelete();
            $table->foreignId('collection_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->decimal('amount', 14, 2);
            $table->date('paid_on');
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->index('paid_on');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('loan_payments');
        Schema::dropIfExists('loans');
        Schema::dropIfExists('expenses');
    }
};
