<?php

namespace App\Http\Controllers;

use App\Enums\RoleScope;
use App\Models\Announcement;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Notificaciones internas. Quien tiene el permiso "notifications.send" envía avisos a
 * los usuarios de su alcance: el administrador a cualquiera; el supervisor a los de su
 * oficina (por defecto, a sus cobradores). Todos reciben y marcan como leídas las suyas.
 */
class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $canSend = $user->can('notifications.send');

        return Inertia::render('notifications/index', [
            'inbox' => $user->announcements()
                ->with('sender:id,name')
                ->orderByDesc('announcements.id')
                ->paginate(15, ['announcements.*'], 'inbox_page')
                ->withQueryString()
                ->through(fn (Announcement $a) => $this->present($a)),
            'sent' => $canSend
                ? Announcement::query()
                    ->where('sender_id', $user->id)
                    ->withCount([
                        'recipients',
                        'recipients as read_count' => fn (Builder $q) => $q->whereNotNull('announcement_user.read_at'),
                    ])
                    ->with(['recipients' => fn ($q) => $q->select('users.id', 'users.name')->orderBy('users.name')])
                    ->latest('id')
                    ->paginate(10, ['*'], 'sent_page')
                    ->withQueryString()
                : null,
            'recipients' => $canSend
                ? $this->allowedRecipients($user)
                    ->with('role:id,name,scope')
                    ->orderBy('name')
                    ->get(['id', 'name', 'role_id'])
                    ->map(fn (User $r) => [
                        'id' => $r->id,
                        'name' => $r->name,
                        'role' => $r->role?->name,
                        'is_collector' => $r->role?->scope === RoleScope::Route,
                    ])
                : [],
        ]);
    }

    /**
     * Contador y últimas notificaciones para la campana (se consulta cada minuto).
     */
    public function feed(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'unread' => $user->announcements()->wherePivotNull('read_at')->count(),
            'items' => $user->announcements()
                ->with('sender:id,name')
                ->orderByDesc('announcements.id')
                ->limit(8)
                ->get(['announcements.*'])
                ->map(fn (Announcement $a) => $this->present($a)),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'body' => ['required', 'string', 'max:2000'],
            'priority' => ['required', Rule::in(Announcement::PRIORITIES)],
            // collectors = todos mis cobradores; selected = los elegidos.
            'audience' => ['required', Rule::in(['collectors', 'selected'])],
            'recipients' => ['required_if:audience,selected', 'array'],
            'recipients.*' => ['integer'],
        ], [
            'recipients.required_if' => 'Elija al menos un destinatario.',
        ], [
            'title' => 'título',
            'body' => 'mensaje',
            'priority' => 'prioridad',
            'recipients' => 'destinatarios',
        ]);

        $query = $this->allowedRecipients($user);

        if ($data['audience'] === 'collectors') {
            $ids = $query->whereHas('role', fn (Builder $q) => $q->where('scope', RoleScope::Route))->pluck('id');
        } else {
            $requested = array_values(array_unique(array_map('intval', $data['recipients'] ?? [])));
            $ids = $query->whereIn('id', $requested)->pluck('id');

            if ($ids->count() !== count($requested)) {
                throw ValidationException::withMessages(['recipients' => 'Algún destinatario no está a su cargo o está inactivo.']);
            }
        }

        if ($ids->isEmpty()) {
            throw ValidationException::withMessages(['recipients' => 'No hay cobradores activos a su cargo para enviar la notificación.']);
        }

        $announcement = Announcement::create([
            'sender_id' => $user->id,
            'office_id' => $user->office_id,
            'title' => $data['title'],
            'body' => $data['body'],
            'priority' => $data['priority'],
        ]);
        $announcement->recipients()->attach($ids->all());

        $count = $ids->count();
        Inertia::flash('toast', ['type' => 'success', 'message' => $count === 1 ? 'Notificación enviada a 1 usuario.' : "Notificación enviada a {$count} usuarios."]);

        return back();
    }

    public function read(Request $request, Announcement $announcement): JsonResponse|RedirectResponse
    {
        DB::table('announcement_user')
            ->where('user_id', $request->user()->id)
            ->where('announcement_id', $announcement->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return $request->expectsJson() ? response()->json(['ok' => true]) : back();
    }

    public function readAll(Request $request): JsonResponse|RedirectResponse
    {
        DB::table('announcement_user')
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return $request->expectsJson() ? response()->json(['ok' => true]) : back();
    }

    /**
     * El remitente (o un administrador) retira la notificación para todos.
     */
    public function destroy(Request $request, Announcement $announcement): RedirectResponse
    {
        $user = $request->user();
        abort_unless($announcement->sender_id === $user->id || $user->seesAllOffices(), 403);

        $announcement->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Notificación retirada.']);

        return back();
    }

    /**
     * Usuarios activos a los que el remitente puede escribir.
     *
     * @return Builder<User>
     */
    private function allowedRecipients(User $sender): Builder
    {
        return User::query()
            ->where('is_active', true)
            ->whereKeyNot($sender->id)
            ->when(! $sender->seesAllOffices(), fn (Builder $q) => $q->where('office_id', $sender->office_id ?? 0));
    }

    /**
     * @return array{id: int, title: string, body: string, excerpt: string, priority: string, sender: string|null, created_at: string|null, read_at: string|null}
     */
    private function present(Announcement $announcement): array
    {
        /** @var object{read_at: string|null}|null $pivot */
        $pivot = $announcement->getRelationValue('pivot');

        return [
            'id' => $announcement->id,
            'title' => $announcement->title,
            'body' => $announcement->body,
            'excerpt' => Str::limit($announcement->body, 140),
            'priority' => $announcement->priority,
            'sender' => $announcement->sender?->name,
            'created_at' => $announcement->created_at?->toIso8601String(),
            'read_at' => $pivot?->read_at ? (string) $pivot->read_at : null,
        ];
    }
}
