<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ciudad / municipio y distrito / zona del negocio. Se llenan solos al tomar la
 * ubicación GPS desde el teléfono (dirección obtenida de la coordenada).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('city', 120)->nullable()->after('address');
            $table->string('district', 120)->nullable()->after('city');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['city', 'district']);
        });
    }
};
