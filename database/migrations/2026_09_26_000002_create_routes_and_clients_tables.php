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
        Schema::create('collection_routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('office_id')->constrained()->restrictOnDelete();
            $table->foreignId('collector_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('code');
            $table->string('name');
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['office_id', 'code']);
        });

        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('collection_route_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->string('business_name')->nullable();
            $table->string('document')->nullable();
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            // Porcentaje de la ganancia neta que se le entrega al cliente en cada corte.
            $table->decimal('commission_percent', 5, 2)->default(0);
            $table->unsignedInteger('visit_order')->default(0);
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('document');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('clients');
        Schema::dropIfExists('collection_routes');
    }
};
