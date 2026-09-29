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
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('description')->nullable();
            // all = ve todas las oficinas, office = solo su oficina, route = solo sus rutas asignadas
            $table->string('scope')->default('office');
            $table->json('permissions');
            $table->timestamps();
        });

        Schema::create('offices', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('city')->nullable();
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->foreignId('office_id')->nullable()->after('role_id')->constrained()->nullOnDelete();
            $table->string('phone')->nullable()->after('email');
            $table->boolean('is_active')->default(true)->after('phone');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('role_id');
            $table->dropConstrainedForeignId('office_id');
            $table->dropColumn(['phone', 'is_active']);
        });

        Schema::dropIfExists('offices');
        Schema::dropIfExists('roles');
    }
};
