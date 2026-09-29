<?php

namespace App\Models;

use App\Enums\RoleScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property string|null $description
 * @property RoleScope $scope
 * @property list<string> $permissions
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'description', 'scope', 'permissions'])]
class Role extends Model
{
    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function allows(string $permission): bool
    {
        return in_array($permission, $this->permissions, true);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scope' => RoleScope::class,
            'permissions' => 'array',
        ];
    }
}
