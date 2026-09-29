<?php

namespace App\Models\Contracts;

use App\Models\User;

interface VisibleToUser
{
    /**
     * Indica si el registro está dentro del alcance de datos del usuario.
     */
    public function isVisibleTo(User $user): bool;
}
