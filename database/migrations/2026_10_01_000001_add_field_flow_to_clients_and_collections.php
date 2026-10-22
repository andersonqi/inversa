<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Flujo de campo del cobrador: día de visita y ubicación del cliente, efectivo contado,
 * observaciones y foto por máquina, y firma del tendero en el corte.
 * Todas las columnas son opcionales para no afectar los datos existentes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            // Día de la semana en que se visita (ISO: 1 = lunes … 7 = domingo).
            $table->unsignedTinyInteger('visit_day')->nullable()->after('visit_order');
            $table->decimal('latitude', 10, 7)->nullable()->after('address');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
        });

        Schema::table('collections', function (Blueprint $table) {
            // Imagen PNG de la firma del tendero (disco local privado).
            $table->string('signature_path')->nullable()->after('notes');
        });

        Schema::table('collection_items', function (Blueprint $table) {
            // Efectivo físico contado en la máquina y su diferencia contra lo teórico (neto).
            $table->decimal('cash_counted', 14, 2)->nullable()->after('net');
            $table->text('notes')->nullable()->after('forced');
            // Foto de evidencia de los contadores (disco local privado).
            $table->string('photo_path')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('collection_items', fn (Blueprint $table) => $table->dropColumn(['cash_counted', 'notes', 'photo_path']));
        Schema::table('collections', fn (Blueprint $table) => $table->dropColumn('signature_path'));
        Schema::table('clients', fn (Blueprint $table) => $table->dropColumn(['visit_day', 'latitude', 'longitude']));
    }
};
