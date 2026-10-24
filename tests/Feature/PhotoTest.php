<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Collection;
use App\Models\Machine;
use App\Services\PhotoStorage;
use App\Support\PhotoRetention;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class PhotoTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    /**
     * PNG de 1×1 px.
     */
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();
        Storage::fake(PhotoStorage::DISK);
    }

    private function image(string $name = 'foto.png'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, (string) base64_decode(self::PNG));
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function clientPayload(array $overrides = []): array
    {
        return [
            'collection_route_id' => $this->route->id,
            'name' => 'Tienda con fotos',
            'commission_percent' => 30,
            'is_active' => '1',
            ...$overrides,
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function machinePayload(array $overrides = []): array
    {
        return [
            'office_id' => $this->office->id,
            'code' => 'MAQ-FOTO',
            'credit_value' => 1,
            'status' => 'warehouse',
            ...$overrides,
        ];
    }

    public function test_client_photos_are_stored_privately_and_shown_to_who_can_see_the_client(): void
    {
        $this->actingAs($this->admin)
            ->post(route('clients.store'), $this->clientPayload([
                'photo' => $this->image('cliente.png'),
                'business_photo' => $this->image('negocio.png'),
            ]))
            ->assertSessionHasNoErrors();

        $client = Client::where('name', 'Tienda con fotos')->firstOrFail();
        $this->assertNotNull($client->photo_path);
        $this->assertNotNull($client->business_photo_path);
        $this->assertStringStartsWith("clients/{$client->id}/", (string) $client->business_photo_path);
        Storage::disk(PhotoStorage::DISK)->assertExists([(string) $client->photo_path, (string) $client->business_photo_path]);

        // El cobrador de la ruta ve las fotos; un supervisor de otra oficina no.
        $this->actingAs($this->collector)->get(route('clients.photo', [$client, 'client']))->assertOk();
        $this->actingAs($this->collector)->get(route('clients.photo', [$client, 'business']))->assertOk();
        $this->actingAs($this->collector)->get("/clients/{$client->id}/photos/otra")->assertNotFound();

        $this->actingAs($this->collector)->get(route('clients.show', $client))
            ->assertInertia(fn (Assert $page) => $page->where('client.business_photo_path', $client->business_photo_path));

        $this->actingAs($this->admin)
            ->put(route('clients.update', $this->otherClient), $this->clientPayload([
                'collection_route_id' => $this->otherRoute->id,
                'name' => 'Tienda Norte',
                'business_photo' => $this->image(),
            ]))
            ->assertSessionHasNoErrors();

        $this->actingAs($this->supervisor)->get(route('clients.photo', [$this->otherClient, 'business']))->assertNotFound();

        // Sin foto guardada responde 404.
        $this->actingAs($this->admin)->get(route('clients.photo', [$this->client, 'business']))->assertNotFound();
    }

    public function test_replacing_or_removing_a_client_photo_deletes_the_previous_file(): void
    {
        $this->actingAs($this->admin)
            ->put(route('clients.update', $this->client), $this->clientPayload([
                'name' => 'Abarrotería Uno',
                'photo' => $this->image(),
                'business_photo' => $this->image(),
            ]))
            ->assertSessionHasNoErrors();

        $first = $this->client->fresh();
        $oldPhoto = (string) $first?->photo_path;
        $businessPhoto = (string) $first?->business_photo_path;

        // Reemplazar la foto del cliente sin tocar la del negocio.
        $this->actingAs($this->admin)
            ->put(route('clients.update', $this->client), $this->clientPayload([
                'name' => 'Abarrotería Uno',
                'photo' => $this->image('nueva.png'),
            ]))
            ->assertSessionHasNoErrors();

        $second = $this->client->fresh();
        $this->assertNotSame($oldPhoto, $second?->photo_path);
        $this->assertSame($businessPhoto, $second?->business_photo_path);
        Storage::disk(PhotoStorage::DISK)->assertMissing($oldPhoto);
        Storage::disk(PhotoStorage::DISK)->assertExists([(string) $second?->photo_path, $businessPhoto]);

        // Quitar la foto del negocio.
        $this->actingAs($this->admin)
            ->put(route('clients.update', $this->client), $this->clientPayload([
                'name' => 'Abarrotería Uno',
                'remove_business_photo' => '1',
                'remove_photo' => '0',
            ]))
            ->assertSessionHasNoErrors();

        $third = $this->client->fresh();
        $this->assertNull($third?->business_photo_path);
        $this->assertSame($second?->photo_path, $third?->photo_path);
        Storage::disk(PhotoStorage::DISK)->assertMissing($businessPhoto);
    }

    public function test_photo_must_be_an_image(): void
    {
        $this->actingAs($this->admin)
            ->post(route('clients.store'), $this->clientPayload([
                'business_photo' => UploadedFile::fake()->createWithContent('documento.txt', 'no es una foto'),
            ]))
            ->assertSessionHasErrors('business_photo');

        $this->assertDatabaseMissing('clients', ['name' => 'Tienda con fotos']);

        $this->actingAs($this->admin)
            ->post(route('machines.store'), $this->machinePayload([
                'photo' => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
            ]))
            ->assertSessionHasErrors('photo');
    }

    public function test_deleting_a_client_removes_its_photos(): void
    {
        $this->actingAs($this->admin)
            ->post(route('clients.store'), $this->clientPayload(['business_photo' => $this->image()]))
            ->assertSessionHasNoErrors();

        $client = Client::where('name', 'Tienda con fotos')->firstOrFail();
        $path = (string) $client->business_photo_path;
        Storage::disk(PhotoStorage::DISK)->assertExists($path);

        $this->actingAs($this->admin)->delete(route('clients.destroy', $client))->assertRedirect(route('clients.index'));

        Storage::disk(PhotoStorage::DISK)->assertMissing($path);
    }

    public function test_machine_photo_is_stored_shown_and_removed_with_the_machine(): void
    {
        $this->actingAs($this->admin)
            ->post(route('machines.store'), $this->machinePayload(['photo' => $this->image('maquina.png')]))
            ->assertSessionHasNoErrors();

        $machine = Machine::where('code', 'MAQ-FOTO')->firstOrFail();
        $path = (string) $machine->photo_path;
        $this->assertStringStartsWith("machines/{$machine->id}/", $path);
        Storage::disk(PhotoStorage::DISK)->assertExists($path);

        $this->actingAs($this->supervisor)->get(route('machines.photo', $machine))->assertOk();
        $this->actingAs($this->supervisor)->get(route('machines.photo', $this->otherMachine))->assertNotFound();

        $this->actingAs($this->admin)->delete(route('machines.destroy', $machine))->assertRedirect(route('machines.index'));

        Storage::disk(PhotoStorage::DISK)->assertMissing($path);
    }

    public function test_old_counter_photos_are_pruned_and_recent_ones_kept(): void
    {
        $disk = Storage::disk(PhotoStorage::DISK);

        $old = $this->collection;
        $old->update(['collected_on' => now()->subDays(PhotoRetention::DEFAULT_DAYS + 5)->toDateString()]);
        $oldItem = $old->items()->firstOrFail();
        $oldItem->update(['photo_path' => "collections/{$old->id}/viejo.jpg"]);
        $disk->put("collections/{$old->id}/viejo.jpg", 'foto');
        $disk->put("collections/{$old->id}/firma.png", 'firma');

        $recent = Collection::query()->whereKeyNot($old->id)->firstOrFail();
        $recentItem = $recent->items()->firstOrFail();
        $recentItem->update(['photo_path' => "collections/{$recent->id}/nuevo.jpg"]);
        $disk->put("collections/{$recent->id}/nuevo.jpg", 'foto');

        $this->artisan('photos:prune')->assertSuccessful();

        $this->assertNull($oldItem->fresh()?->photo_path);
        $disk->assertMissing("collections/{$old->id}/viejo.jpg");
        // La firma y el corte se conservan.
        $disk->assertExists("collections/{$old->id}/firma.png");
        $this->assertModelExists($old);

        $this->assertSame("collections/{$recent->id}/nuevo.jpg", $recentItem->fresh()?->photo_path);
        $disk->assertExists("collections/{$recent->id}/nuevo.jpg");

        // Con un plazo más corto también se eliminan las recientes (el corte es de hoy,
        // así que se fecha unos días atrás).
        $recent->update(['collected_on' => now()->subDays(10)->toDateString()]);
        PhotoRetention::save(7);

        $this->assertSame(1, app(PhotoStorage::class)->pruneCounterPhotos());
        $this->assertNull($recentItem->fresh()?->photo_path);
        $disk->assertMissing("collections/{$recent->id}/nuevo.jpg");
    }

    public function test_admin_configures_photo_retention(): void
    {
        $this->assertSame(PhotoRetention::DEFAULT_DAYS, PhotoRetention::current()->days);

        $this->actingAs($this->admin)->get(route('branding.edit'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('settings/branding')
                ->where('photoRetention.days', PhotoRetention::DEFAULT_DAYS));

        $this->actingAs($this->admin)
            ->from(route('branding.edit'))
            ->put(route('parameters.photos'), ['days' => 180])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('branding.edit'))
            ->assertInertiaFlash('toast.type', 'success');

        $this->assertSame(180, PhotoRetention::current()->days);

        $this->actingAs($this->admin)
            ->put(route('parameters.photos'), ['days' => 3])
            ->assertSessionHasErrors('days');

        $this->actingAs($this->admin)
            ->put(route('parameters.photos'), ['days' => 'mucho'])
            ->assertSessionHasErrors('days');

        foreach ([$this->supervisor, $this->collector] as $user) {
            $this->actingAs($user)->put(route('parameters.photos'), ['days' => 30])->assertForbidden();
        }

        $this->assertSame(180, PhotoRetention::current()->days);
    }

    public function test_android_asset_links_are_published_only_when_configured(): void
    {
        $this->getJson('/.well-known/assetlinks.json')->assertOk()->assertExactJson([]);

        config([
            'services.android.package' => 'gt.inversa.app',
            'services.android.sha256_fingerprints' => ['AA:BB:CC'],
        ]);

        $this->getJson('/.well-known/assetlinks.json')
            ->assertOk()
            ->assertJsonPath('0.relation.0', 'delegate_permission/common.handle_all_urls')
            ->assertJsonPath('0.target.namespace', 'android_app')
            ->assertJsonPath('0.target.package_name', 'gt.inversa.app')
            ->assertJsonPath('0.target.sha256_cert_fingerprints.0', 'AA:BB:CC');
    }
}
