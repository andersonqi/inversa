<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * Notificación enviada por un supervisor (o administrador) a uno o varios usuarios.
 *
 * @property int $id
 * @property int|null $sender_id
 * @property int|null $office_id
 * @property string $title
 * @property string $body
 * @property string $priority normal | urgent
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['sender_id', 'office_id', 'title', 'body', 'priority'])]
class Announcement extends Model
{
    public const PRIORITIES = ['normal', 'urgent'];

    /**
     * @return BelongsTo<User, $this>
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /**
     * @return BelongsTo<Office, $this>
     */
    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function recipients(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withPivot('read_at');
    }
}
