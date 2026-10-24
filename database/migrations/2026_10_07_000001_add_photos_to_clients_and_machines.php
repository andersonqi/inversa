<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fotos de referencia: del cliente (la persona), del negocio y de cada máquina. Se
 * guardan en el disco privado y se sirven solo a quien puede ver el registro.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('photo_path')->nullable()->after('notes');
            $table->string('business_photo_path')->nullable()->after('photo_path');
        });

        Schema::table('machines', function (Blueprint $table) {
            $table->string('photo_path')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn(['photo_path', 'business_photo_path']);
        });

        Schema::table('machines', function (Blueprint $table) {
            $table->dropColumn('photo_path');
        });
    }
};
