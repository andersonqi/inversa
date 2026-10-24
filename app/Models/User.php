<?php

namespace App\Models;

use App\Enums\RoleScope;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property int|null $role_id
 * @property int|null $office_id
 * @property string $name
 * @property string $email
 * @property string|null $phone
 * @property bool $is_active
 * @property string|null $accent_color Color de la interfaz elegido por el usuario (#rrggbb).
 * @property-read Role|null $role
 * @property-read Office|null $office
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'password', 'phone', 'role_id', 'office_id', 'is_active', 'email_verified_at', 'accent_color'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    /**
     * @var array<int, int>|null
     */
    protected ?array $cachedRouteIds = null;

    /**
     * @return BelongsTo<Role, $this>
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * @return BelongsTo<Office, $this>
     */
    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    /**
     * Rutas asignadas al usuario como cobrador.
     *
     * @return HasMany<CollectionRoute, $this>
     */
    public function routes(): HasMany
    {
        return $this->hasMany(CollectionRoute::class, 'collector_id');
    }

    /**
     * Notificaciones recibidas (con su fecha de lectura).
     *
     * @return BelongsToMany<Announcement, $this>
     */
    public function announcements(): BelongsToMany
    {
        return $this->belongsToMany(Announcement::class)->withPivot('read_at');
    }

    public function hasPermission(string $permission): bool
    {
        return $this->role?->allows($permission) ?? false;
    }

    /**
     * Alcance de datos del usuario. Sin oficina asignada, un rol de oficina no ve nada.
     */
    public function scope(): RoleScope
    {
        return $this->role->scope ?? RoleScope::Route;
    }

    public function seesAllOffices(): bool
    {
        return $this->scope() === RoleScope::All;
    }

    /**
     * @return array<int, int>
     */
    public function routeIds(): array
    {
        return $this->cachedRouteIds ??= $this->routes()->pluck('id')->map(fn (mixed $id): int => (int) $id)->all();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }
}
