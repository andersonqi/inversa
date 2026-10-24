<?php

namespace Tests\Feature;

use App\Models\Collection;
use App\Services\CollectionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

/**
 * Cortes registrados sin conexión: descarga de la ruta, sincronización idempotente y
 * conflictos con cortes registrados mientras el teléfono no tenía señal.
 */
class CollectionSyncTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Tras el corte de BuildsOperation, MAQ-1 quedó en 1100 / 550 (crédito ₡100).
        $this->buildOperation();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function offlinePayload(int $baseIn = 1100, int $baseOut = 550, int $in = 1180, int $out = 590, array $overrides = []): array
    {
        return [
            'offline_id' => (string) Str::uuid(),
            'client_id' => $this->client->id,
            'collected_on' => now()->toDateString(),
            'items' => [[
                'machine_id' => $this->machine->id,
                'base_in' => $baseIn,
                'base_out' => $baseOut,
                'current_in' => $in,
                'current_out' => $out,
            ]],
            ...$overrides,
        ];
    }

    public function test_route_data_is_downloaded_for_the_users_scope(): void
    {
        $this->actingAs($this->collector)
            ->getJson(route('collections.offline'))
            ->assertOk()
            ->assertJsonPath('user_id', $this->collector->id)
            ->assertJsonCount(1, 'clients')
            ->assertJsonPath('clients.0.id', $this->client->id)
            ->assertJsonPath('clients.0.machines.0.code', 'MAQ-1')
            ->assertJsonPath('clients.0.machines.0.counter_in', 1100);
    }

    public function test_offline_page_renders(): void
    {
        $this->actingAs($this->collector)
            ->get(route('offline'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('offline'));
    }

    public function test_offline_collection_is_synced_once(): void
    {
        $payload = $this->offlinePayload();

        $this->actingAs($this->collector)
            ->postJson(route('collections.sync'), $payload)
            ->assertCreated()
            ->assertJsonPath('status', 'created');

        $collection = Collection::where('offline_id', $payload['offline_id'])->firstOrFail();

        $this->actingAs($this->collector)
            ->postJson(route('collections.sync'), $payload)
            ->assertJsonPath('receipt_url', "/collections/{$collection->id}/receipt");
        $this->assertSame($this->collector->id, $collection->user_id);
        // (80 − 40) créditos × ₡100.
        $this->assertSame('4000.00', $collection->net);

        // Reintento (p. ej. se perdió la respuesta): no se duplica.
        $this->actingAs($this->collector)
            ->postJson(route('collections.sync'), $payload)
            ->assertOk()
            ->assertJsonPath('status', 'duplicate')
            ->assertJsonPath('collection_id', $collection->id);

        // El corte de BuildsOperation más el sincronizado.
        $this->assertSame(2, Collection::where('client_id', $this->client->id)->count());
    }

    public function test_second_collection_on_the_same_machine_is_reported_as_conflict(): void
    {
        // Mientras el teléfono estaba sin señal se registró otro corte de MAQ-1.
        $online = app(CollectionService::class)->record($this->supervisor, $this->client, [
            'collected_on' => now()->toDateString(),
            'items' => [['machine_id' => $this->machine->id, 'current_in' => 1150, 'current_out' => 570]],
        ]);

        $this->actingAs($this->collector)
            ->postJson(route('collections.sync'), $this->offlinePayload())
            ->assertConflict()
            ->assertJsonPath('status', 'conflict')
            ->assertJsonPath('machines.0.code', 'MAQ-1')
            ->assertJsonPath('machines.0.base_in', 1100)
            ->assertJsonPath('machines.0.current_in', 1150)
            ->assertJsonCount(1, 'competing')
            ->assertJsonPath('competing.0.id', $online->id)
            ->assertJsonPath('competing.0.user', $this->supervisor->name)
            // El cobrador no puede anular cortes de otro usuario.
            ->assertJsonPath('competing.0.can_replace', false);

        $this->assertModelExists($online);
        $this->assertSame(1150, $this->machine->fresh()?->counter_in);
    }

    public function test_choosing_the_offline_collection_voids_the_registered_one(): void
    {
        $online = app(CollectionService::class)->record($this->collector, $this->client, [
            'collected_on' => now()->toDateString(),
            'items' => [['machine_id' => $this->machine->id, 'current_in' => 1150, 'current_out' => 570]],
        ]);

        $payload = $this->offlinePayload(overrides: ['resolution' => 'replace', 'replace_ids' => [$online->id]]);

        $this->actingAs($this->collector)
            ->postJson(route('collections.sync'), $payload)
            ->assertCreated();

        $this->assertModelMissing($online);

        $synced = Collection::where('offline_id', $payload['offline_id'])->firstOrFail();
        $item = $synced->items()->firstOrFail();
        $this->assertSame(1100, $item->previous_in);
        $this->assertSame(1180, $item->current_in);
        $this->assertSame(1180, $this->machine->fresh()?->counter_in);
        $this->assertSame(590, $this->machine->fresh()?->counter_out);
    }

    public function test_replace_requires_the_same_collections_seen_in_the_dialog(): void
    {
        $online = app(CollectionService::class)->record($this->collector, $this->client, [
            'collected_on' => now()->toDateString(),
            'items' => [['machine_id' => $this->machine->id, 'current_in' => 1150, 'current_out' => 570]],
        ]);

        $this->actingAs($this->collector)
            ->postJson(route('collections.sync'), $this->offlinePayload(overrides: ['resolution' => 'replace', 'replace_ids' => [$online->id + 99]]))
            ->assertConflict();

        $this->assertModelExists($online);
    }

    public function test_user_without_permission_cannot_replace_someone_elses_collection(): void
    {
        $online = app(CollectionService::class)->record($this->supervisor, $this->client, [
            'collected_on' => now()->toDateString(),
            'items' => [['machine_id' => $this->machine->id, 'current_in' => 1150, 'current_out' => 570]],
        ]);

        $this->actingAs($this->collector)
            ->postJson(route('collections.sync'), $this->offlinePayload(overrides: ['resolution' => 'replace', 'replace_ids' => [$online->id]]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('resolution');

        $this->assertModelExists($online);
    }

    public function test_supervisor_can_keep_the_offline_collection_of_a_collector(): void
    {
        $online = app(CollectionService::class)->record($this->collector, $this->client, [
            'collected_on' => now()->toDateString(),
            'items' => [['machine_id' => $this->machine->id, 'current_in' => 1150, 'current_out' => 570]],
        ]);

        $this->actingAs($this->supervisor)
            ->postJson(route('collections.sync'), $this->offlinePayload())
            ->assertConflict()
            ->assertJsonPath('competing.0.can_replace', true);

        $this->actingAs($this->supervisor)
            ->postJson(route('collections.sync'), $this->offlinePayload(overrides: ['resolution' => 'replace', 'replace_ids' => [$online->id]]))
            ->assertCreated();

        $this->assertModelMissing($online);
    }

    public function test_sync_validates_the_payload_and_the_client_scope(): void
    {
        $payload = $this->offlinePayload();
        unset($payload['items'][0]['base_in']);

        $this->actingAs($this->collector)
            ->postJson(route('collections.sync'), $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items.0.base_in');

        $this->actingAs($this->collector)
            ->postJson(route('collections.sync'), $this->offlinePayload(overrides: ['client_id' => $this->otherClient->id]))
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error');

        // Contadores menores a los anteriores: mismas reglas que un corte normal.
        $this->actingAs($this->collector)
            ->postJson(route('collections.sync'), $this->offlinePayload(in: 1050))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items.0.current_in');
    }

    public function test_guests_get_401_so_the_phone_keeps_the_queue(): void
    {
        $this->postJson(route('collections.sync'), $this->offlinePayload())->assertUnauthorized();
    }
}
