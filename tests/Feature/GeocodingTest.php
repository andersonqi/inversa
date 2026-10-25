<?php

namespace Tests\Feature;

use App\Enums\RoleScope;
use App\Models\Client;
use App\Models\Role;
use App\Models\User;
use App\Services\GeocodingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class GeocodingTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();
    }

    /**
     * Respuesta de Nominatim para un punto de la zona 10 de la Ciudad de Guatemala.
     *
     * @return array<string, mixed>
     */
    private function nominatim(): array
    {
        return [
            'display_name' => '12 Calle, Zona Viva, Zona 10, Guatemala, Departamento de Guatemala, 01010, Guatemala',
            'address' => [
                'road' => '12 Calle',
                'house_number' => '1-25',
                'neighbourhood' => 'Zona Viva',
                'suburb' => 'Zona 10',
                'city' => 'Guatemala',
                'state' => 'Departamento de Guatemala',
                'postcode' => '01010',
                'country' => 'Guatemala',
            ],
        ];
    }

    public function test_reverse_geocoding_returns_address_city_and_district(): void
    {
        Http::fake(['nominatim.openstreetmap.org/*' => Http::response($this->nominatim())]);

        $this->actingAs($this->supervisor)
            ->getJson(route('geocoding.reverse', ['latitude' => '14.6011450', 'longitude' => '-90.5083210']))
            ->assertOk()
            ->assertExactJson([
                'found' => true,
                'address' => '12 Calle 1-25, Zona Viva',
                'city' => 'Guatemala',
                'district' => 'Zona 10',
            ]);

        Http::assertSent(fn (HttpRequest $request) => str_contains($request->url(), '/reverse')
            && $request['format'] === 'jsonv2'
            && $request->hasHeader('User-Agent'));

        // La misma coordenada se responde desde la caché.
        $this->actingAs($this->supervisor)
            ->getJson(route('geocoding.reverse', ['latitude' => '14.6011450', 'longitude' => '-90.5083210']))
            ->assertJsonPath('district', 'Zona 10');

        Http::assertSentCount(1);
    }

    public function test_without_street_the_place_name_is_used(): void
    {
        $place = GeocodingService::fromNominatim(
            ['village' => 'San Juan Sacatepéquez', 'hamlet' => 'Aldea Cruz Blanca'],
            'Aldea Cruz Blanca, San Juan Sacatepéquez, Guatemala',
        );

        $this->assertSame([
            'address' => 'Aldea Cruz Blanca, San Juan Sacatepéquez',
            'city' => 'San Juan Sacatepéquez',
            'district' => 'Aldea Cruz Blanca',
        ], $place);
    }

    public function test_service_failure_is_reported_as_not_found(): void
    {
        Http::fake(['*' => Http::response('', 503)]);

        $this->actingAs($this->collector)
            ->getJson(route('geocoding.reverse', ['latitude' => 14.6, 'longitude' => -90.5]))
            ->assertOk()
            ->assertJson(['found' => false, 'address' => null, 'city' => null, 'district' => null]);
    }

    public function test_reverse_geocoding_validates_and_requires_permission(): void
    {
        Http::fake();

        $this->actingAs($this->supervisor)
            ->getJson(route('geocoding.reverse', ['latitude' => 200, 'longitude' => -90.5]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('latitude');

        $readOnly = User::factory()->create([
            'role_id' => Role::create(['name' => 'Consulta', 'scope' => RoleScope::All, 'permissions' => ['clients.view']])->id,
        ]);

        $this->actingAs($readOnly)
            ->getJson(route('geocoding.reverse', ['latitude' => 14.6, 'longitude' => -90.5]))
            ->assertForbidden();

        Http::assertNothingSent();
    }

    public function test_client_stores_city_and_district(): void
    {
        $this->actingAs($this->admin)
            ->post(route('clients.store'), [
                'collection_route_id' => $this->route->id,
                'name' => 'Tienda Zona 10',
                'address' => '12 Calle 1-25',
                'district' => 'Zona 10',
                'city' => 'Guatemala',
                'latitude' => '14.6011450',
                'longitude' => '-90.5083210',
                'commission_percent' => 30,
                'is_active' => '1',
            ])
            ->assertSessionHasNoErrors();

        $client = Client::where('name', 'Tienda Zona 10')->firstOrFail();
        $this->assertSame('Zona 10', $client->district);
        $this->assertSame('Guatemala', $client->city);
        $this->assertSame('14.6011450', $client->latitude);

        // Se puede buscar por zona o ciudad.
        $this->actingAs($this->admin)
            ->get(route('clients.index', ['search' => 'zona 10']))
            ->assertInertia(fn ($page) => $page->where('clients.data.0.id', $client->id));
    }

    public function test_field_location_only_fills_empty_address_fields(): void
    {
        $this->client->update(['address' => 'Frente al parque', 'city' => null, 'district' => null]);

        $this->actingAs($this->collector)
            ->post(route('clients.location', $this->client), [
                'latitude' => '14.6011450',
                'longitude' => '-90.5083210',
                'address' => '12 Calle 1-25',
                'city' => 'Guatemala',
                'district' => 'Zona 10',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $client = $this->client->fresh();
        $this->assertSame('14.6011450', $client?->latitude);
        // La dirección escrita por la oficina se respeta; lo vacío se completa.
        $this->assertSame('Frente al parque', $client?->address);
        $this->assertSame('Guatemala', $client?->city);
        $this->assertSame('Zona 10', $client?->district);
    }
}
