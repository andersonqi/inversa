<?php

namespace Tests\Feature;

use App\Support\PerformanceThresholds;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

/**
 * Montos semanales de la clasificación de rendimiento de máquinas. En BuildsOperation,
 * MAQ-1 ganó Q5,000 hoy (≈ Q1,166.67 por semana en 30 días) y MAQ-2 perdió Q1,000.
 */
class PerformanceThresholdsTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();
    }

    public function test_default_amounts_are_used_until_changed(): void
    {
        $thresholds = PerformanceThresholds::current();

        $this->assertSame(PerformanceThresholds::DEFAULT_EXCELLENT, $thresholds->excellent);
        $this->assertSame(PerformanceThresholds::DEFAULT_POOR, $thresholds->poor);
        $this->assertSame('excellent', $thresholds->classify(1000));
        $this->assertSame('good', $thresholds->classify(300));
        $this->assertSame('poor', $thresholds->classify(299.99));
    }

    public function test_admin_changes_the_amounts_and_the_dashboard_uses_them(): void
    {
        $this->actingAs($this->admin)
            ->from(route('dashboard'))
            ->put(route('parameters.performance'), ['excellent' => 2000, 'poor' => 500])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('dashboard'))
            ->assertInertiaFlash('toast.type', 'success');

        $this->assertSame(2000.0, PerformanceThresholds::current()->excellent);
        $this->assertSame(500.0, PerformanceThresholds::current()->poor);

        // Con Excelente desde Q2,000, MAQ-1 (≈ Q1,166.67 por semana) pasa a "Bueno".
        $this->actingAs($this->admin)->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->loadDeferredProps('route', fn (Assert $reload) => $reload
                    ->where('route.performance.thresholds.excellent', 2000)
                    ->where('route.performance.thresholds.poor', 500)
                    ->has('route.performance.thresholds.excellent_presets')
                    ->where('route.performance.excellent', 0)
                    ->where('route.performance.good', 1)
                    ->where('route.performance.poor', 1)));
    }

    public function test_insufficient_amount_must_be_lower_than_excellent(): void
    {
        $this->actingAs($this->admin)
            ->put(route('parameters.performance'), ['excellent' => 500, 'poor' => 500])
            ->assertSessionHasErrors('poor');

        $this->actingAs($this->admin)
            ->put(route('parameters.performance'), ['excellent' => 0, 'poor' => 0])
            ->assertSessionHasErrors('excellent');

        $this->assertSame(PerformanceThresholds::DEFAULT_EXCELLENT, PerformanceThresholds::current()->excellent);
    }

    public function test_only_users_with_permission_can_change_the_amounts(): void
    {
        foreach ([$this->supervisor, $this->collector] as $user) {
            $this->actingAs($user)
                ->put(route('parameters.performance'), ['excellent' => 2000, 'poor' => 500])
                ->assertForbidden();
        }

        $this->assertSame(PerformanceThresholds::DEFAULT_EXCELLENT, PerformanceThresholds::current()->excellent);
    }

    public function test_only_earnings_at_the_current_location_count(): void
    {
        // MAQ-1 se instaló hoy en su ubicación actual: el corte de hace 10 días fue en otra.
        $this->collection->update(['collected_on' => now()->subDays(10)->toDateString()]);
        $this->machine->update(['installed_at' => now()->toDateString()]);

        $this->actingAs($this->supervisor)->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->loadDeferredProps('route', fn (Assert $reload) => $reload
                    ->where('route.performance.poor', 1)
                    ->where('route.performance.worst.0.code', 'MAQ-1')
                    ->where('route.performance.worst.0.weekly', 0)));
    }

    public function test_machines_report_includes_the_amounts_and_period_weeks(): void
    {
        $from = now()->subDays(13)->toDateString();
        $to = now()->toDateString();

        $this->actingAs($this->admin)
            ->get(route('reports.machines', ['from' => $from, 'to' => $to, 'only_losing' => 0]))
            ->assertInertia(fn (Assert $page) => $page
                ->component('reports/machines')
                ->where('weeks', 2)
                ->where('thresholds.excellent', 1000)
                ->where('thresholds.poor', 300));
    }
}
