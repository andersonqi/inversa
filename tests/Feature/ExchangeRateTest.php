<?php

namespace Tests\Feature;

use App\Models\ExchangeRate;
use App\Models\User;
use App\Services\ExchangeRateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ExchangeRateTest extends TestCase
{
    use RefreshDatabase;

    private const BANGUAT_XML = <<<'XML'
        <?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <TipoCambioDiaResponse xmlns="http://www.banguat.gob.gt/variables/ws/">
              <TipoCambioDiaResult>
                <CambioDolar>
                  <VarDolar>
                    <fecha>03/10/2026</fecha>
                    <referencia>7.71245</referencia>
                  </VarDolar>
                </CambioDolar>
                <TotalItems>1</TotalItems>
              </TipoCambioDiaResult>
            </TipoCambioDiaResponse>
          </soap:Body>
        </soap:Envelope>
        XML;

    public function test_rate_is_taken_from_banguat(): void
    {
        Http::fake([
            'www.banguat.gob.gt/*' => Http::response(self::BANGUAT_XML),
            'open.er-api.com/*' => Http::response(['rates' => ['GTQ' => 9.99]]),
        ]);

        $rate = app(ExchangeRateService::class)->refresh();

        $this->assertSame('7.712450', $rate->rate);
        $this->assertSame('2026-10-03', $rate->rate_date->toDateString());
        $this->assertSame(ExchangeRateService::BANGUAT_SOURCE, $rate->source);

        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'banguat.gob.gt')
            && str_contains($request->header('SOAPAction')[0] ?? '', 'TipoCambioDia'));
        Http::assertNotSent(fn (Request $request) => str_contains($request->url(), 'open.er-api.com'));
    }

    public function test_fallback_source_is_used_when_banguat_fails(): void
    {
        Http::fake([
            'www.banguat.gob.gt/*' => Http::response('error', 500),
            'open.er-api.com/*' => Http::response(['result' => 'success', 'time_last_update_unix' => 1790985600, 'rates' => ['GTQ' => 7.7]]),
        ]);

        $rate = app(ExchangeRateService::class)->refresh();

        $this->assertSame('7.700000', $rate->rate);
        $this->assertSame(ExchangeRateService::FALLBACK_SOURCE, $rate->source);
    }

    public function test_implausible_values_are_rejected(): void
    {
        Http::fake([
            'www.banguat.gob.gt/*' => Http::response(str_replace('7.71245', '0.12', self::BANGUAT_XML)),
            'open.er-api.com/*' => Http::response(['rates' => ['GTQ' => 'abc']]),
        ]);

        $this->expectException(\RuntimeException::class);

        app(ExchangeRateService::class)->refresh();
    }

    public function test_same_day_refresh_updates_instead_of_duplicating(): void
    {
        Http::fake(['www.banguat.gob.gt/*' => Http::response(self::BANGUAT_XML)]);

        $service = app(ExchangeRateService::class);
        $service->refresh();
        $service->refresh();

        $this->assertSame(1, ExchangeRate::count());
    }

    public function test_current_rate_is_shared_with_the_pages(): void
    {
        Http::fake(['www.banguat.gob.gt/*' => Http::response(self::BANGUAT_XML)]);
        app(ExchangeRateService::class)->refresh();

        $this->actingAs(User::factory()->create())
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('exchangeRate.rate', 7.71245)
                ->where('exchangeRate.date', '2026-10-03')
                ->where('exchangeRate.source', ExchangeRateService::BANGUAT_SOURCE));
    }

    public function test_refresh_button_reports_success(): void
    {
        Http::fake(['www.banguat.gob.gt/*' => Http::response(self::BANGUAT_XML)]);

        $this->actingAs(User::factory()->create())
            ->from(route('dashboard'))
            ->post(route('exchange.refresh'))
            ->assertRedirect(route('dashboard'))
            ->assertInertiaFlash('toast.type', 'success');

        $this->assertSame(1, ExchangeRate::count());
    }

    public function test_refresh_button_keeps_last_rate_when_sources_fail(): void
    {
        Http::fake(['*' => Http::response('', 503)]);

        $this->actingAs(User::factory()->create())
            ->from(route('dashboard'))
            ->post(route('exchange.refresh'))
            ->assertRedirect(route('dashboard'))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertSame(0, ExchangeRate::count());
    }

    public function test_fresh_rate_is_not_requested_again(): void
    {
        ExchangeRate::create([
            'currency' => 'USD',
            'rate' => 7.7,
            'rate_date' => now()->toDateString(),
            'source' => ExchangeRateService::BANGUAT_SOURCE,
            'fetched_at' => now()->subMinutes(10),
        ]);

        Http::fake();
        app(ExchangeRateService::class)->refreshIfStale();

        Http::assertNothingSent();
    }

    public function test_stale_rate_is_refreshed(): void
    {
        ExchangeRate::create([
            'currency' => 'USD',
            'rate' => 7.7,
            'rate_date' => now()->subDay()->toDateString(),
            'source' => ExchangeRateService::BANGUAT_SOURCE,
            'fetched_at' => now()->subHours(3),
        ]);

        Http::fake(['www.banguat.gob.gt/*' => Http::response(self::BANGUAT_XML)]);
        app(ExchangeRateService::class)->refreshIfStale();

        $this->assertSame(7.71245, app(ExchangeRateService::class)->current()['rate'] ?? null);
    }

    public function test_sync_command_stores_the_rate(): void
    {
        Http::fake(['www.banguat.gob.gt/*' => Http::response(self::BANGUAT_XML)]);

        $this->artisan('exchange-rate:sync')->assertSuccessful();

        $this->assertSame(1, ExchangeRate::count());
    }
}
