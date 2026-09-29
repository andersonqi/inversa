<?php

namespace App\Models\Concerns;

use App\Models\User;

/**
 * Implementa VisibleToUser usando el scope visibleTo() del modelo.
 */
trait ChecksVisibility
{
    public function isVisibleTo(User $user): bool
    {
        return static::query()->visibleTo($user)->whereKey($this->getKey())->exists();
    }
}
