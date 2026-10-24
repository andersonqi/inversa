<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    private User $otherCollector;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();

        // Cobrador de la oficina Norte (creado en BuildsOperation).
        $this->otherCollector = User::query()
            ->where('office_id', $this->otherOffice->id)
            ->where('role_id', $this->roleId('Cobrador'))
            ->firstOrFail();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'title' => 'Ruta adelantada',
            'body' => 'Mañana la ruta inicia a las 7:00.',
            'priority' => 'normal',
            'audience' => 'collectors',
            ...$overrides,
        ];
    }

    public function test_supervisor_notifies_the_collectors_of_their_office(): void
    {
        $this->actingAs($this->supervisor)
            ->from(route('notifications.index'))
            ->post(route('notifications.store'), $this->payload(['priority' => 'urgent']))
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('notifications.index'))
            ->assertInertiaFlash('toast.type', 'success');

        $announcement = Announcement::firstOrFail();
        $this->assertSame($this->supervisor->id, $announcement->sender_id);
        $this->assertSame('urgent', $announcement->priority);
        $this->assertSame([$this->collector->id], $announcement->recipients()->pluck('users.id')->all());

        $this->actingAs($this->collector)
            ->getJson(route('notifications.feed'))
            ->assertOk()
            ->assertJsonPath('unread', 1)
            ->assertJsonPath('items.0.title', 'Ruta adelantada')
            ->assertJsonPath('items.0.priority', 'urgent')
            ->assertJsonPath('items.0.sender', $this->supervisor->name)
            ->assertJsonPath('items.0.read_at', null);

        // El cobrador de otra oficina no la recibe.
        $this->actingAs($this->otherCollector)
            ->getJson(route('notifications.feed'))
            ->assertJsonPath('unread', 0);
    }

    public function test_recipient_marks_notifications_as_read(): void
    {
        $this->actingAs($this->supervisor)->post(route('notifications.store'), $this->payload());
        $this->actingAs($this->supervisor)->post(route('notifications.store'), $this->payload(['title' => 'Otra']));

        $first = Announcement::orderBy('id')->firstOrFail();

        $this->actingAs($this->collector)
            ->postJson(route('notifications.read', $first))
            ->assertOk();

        $this->actingAs($this->collector)->getJson(route('notifications.feed'))->assertJsonPath('unread', 1);

        $this->actingAs($this->collector)->postJson(route('notifications.readAll'))->assertOk();

        $this->actingAs($this->collector)->getJson(route('notifications.feed'))->assertJsonPath('unread', 0);

        // El remitente ve cuántos la leyeron.
        $this->actingAs($this->supervisor)->get(route('notifications.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('notifications/index')
                ->has('sent.data', 2)
                ->where('sent.data.0.recipients_count', 1)
                ->where('sent.data.0.read_count', 1));
    }

    public function test_supervisor_can_only_choose_users_of_their_office(): void
    {
        $this->actingAs($this->supervisor)
            ->post(route('notifications.store'), $this->payload([
                'audience' => 'selected',
                'recipients' => [$this->collector->id, $this->otherCollector->id],
            ]))
            ->assertSessionHasErrors('recipients');

        $this->assertSame(0, Announcement::count());

        $this->actingAs($this->supervisor)
            ->post(route('notifications.store'), $this->payload([
                'audience' => 'selected',
                'recipients' => [$this->collector->id],
            ]))
            ->assertSessionHasNoErrors();

        $this->actingAs($this->supervisor)->get(route('notifications.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('recipients', fn ($recipients) => collect($recipients)->pluck('id')->doesntContain($this->otherCollector->id)));
    }

    public function test_admin_can_notify_collectors_of_every_office(): void
    {
        $this->actingAs($this->admin)
            ->post(route('notifications.store'), $this->payload())
            ->assertSessionHasNoErrors();

        $ids = Announcement::firstOrFail()->recipients()->pluck('users.id')->sort()->values()->all();
        $expected = collect([$this->collector->id, $this->otherCollector->id])->sort()->values()->all();

        $this->assertSame($expected, $ids);
    }

    public function test_collectors_cannot_send_and_only_sender_can_withdraw(): void
    {
        $this->actingAs($this->collector)
            ->post(route('notifications.store'), $this->payload())
            ->assertForbidden();

        $this->actingAs($this->supervisor)->post(route('notifications.store'), $this->payload());
        $announcement = Announcement::firstOrFail();

        $this->actingAs($this->collector)
            ->delete(route('notifications.destroy', $announcement))
            ->assertForbidden();

        $this->actingAs($this->supervisor)
            ->delete(route('notifications.destroy', $announcement))
            ->assertRedirect();

        $this->assertModelMissing($announcement);
    }

    public function test_everyone_can_open_the_notifications_page(): void
    {
        $this->actingAs($this->collector)->get(route('notifications.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('notifications/index')
                ->where('sent', null)
                ->where('recipients', []));
    }
}
