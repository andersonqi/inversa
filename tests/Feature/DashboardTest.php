<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page(): void
    {
        $this->get(route('dashboard'))->assertRedirect(route('login'));
    }

    public function test_a_user_without_role_sees_an_empty_dashboard(): void
    {
        $this->actingAs(User::factory()->create())
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('stats.today_visits', 0));
    }

    public function test_dashboard_stats_match_the_operation(): void
    {
        $this->buildOperation();

        $this->actingAs($this->admin)->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('dashboard')
                ->where('stats.today_net', 4000)
                ->where('stats.today_cash', 2500)
                ->where('stats.today_visits', 2)
                ->where('stats.month_company', 2900)
                ->where('stats.month_expenses', 85000)
                ->where('stats.loans_balance', 120000)
                ->where('stats.machines_installed', 2)
                ->where('stats.machines_total', 2)
                ->where('stats.losing_month', 1)
                // El gráfico y los últimos cortes llegan en una segunda petición.
                ->missing('series')
                ->missing('recent')
                ->loadDeferredProps(fn (Assert $reload) => $reload
                    ->has('series', 14)
                    ->where('series.13.value', 2900)
                    ->has('recent', 2)));
    }

    public function test_route_stats_show_coverage_weekly_performance_and_stale_loans(): void
    {
        $this->buildOperation();

        $todayIndex = now()->dayOfWeekIso - 1;

        $this->actingAs($this->admin)->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->missing('route')
                ->loadDeferredProps('route', fn (Assert $reload) => $reload
                    ->where('route.coverage.clients_visited', 2)
                    ->where('route.coverage.clients_total', 2)
                    ->where('route.coverage.machines_collected', 2)
                    ->where('route.coverage.machines_total', 2)
                    ->has('route.weekly', 4)
                    ->where('route.weekly.0.total', 2500)
                    ->where("route.weekly.0.days.{$todayIndex}", 2500)
                    ->where('route.weekly.1.total', 0)
                    // MAQ-1 ganó ₡5.000 y MAQ-2 perdió ₡1.000: promedio ₡2.000.
                    ->where('route.performance.excellent', 1)
                    ->where('route.performance.good', 0)
                    ->where('route.performance.poor', 1)
                    ->where('route.performance.worst.0.code', 'MAQ-2')
                    ->has('route.shortages', 0)
                    // Préstamo otorgado hace 3 semanas, sin abonos.
                    ->where('route.arrears.count', 1)
                    ->where('route.arrears.loans.0.days', 21)
                    ->where('route.arrears.loans.0.last_payment_on', null)));
    }

    public function test_route_stats_list_shortages_and_skip_loans_with_recent_payments(): void
    {
        $this->buildOperation();

        $this->collection->items()->firstOrFail()->update(['cash_counted' => 4200]);
        $this->loan->payments()->create([
            'user_id' => $this->collector->id,
            'amount' => 15000,
            'paid_on' => now()->subDays(3)->toDateString(),
        ]);

        $this->actingAs($this->collector)->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->loadDeferredProps('route', fn (Assert $reload) => $reload
                    ->where('route.coverage.clients_total', 1)
                    ->has('route.shortages', 1)
                    ->where('route.shortages.0.code', 'MAQ-1')
                    ->where('route.shortages.0.difference', -800)
                    ->where('route.arrears.count', 0)));
    }

    public function test_supervisor_dashboard_only_counts_their_office(): void
    {
        $this->buildOperation();

        $this->actingAs($this->supervisor)->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.today_net', 5000)
                ->where('stats.month_expenses', 5000)
                ->where('stats.machines_installed', 1)
                ->where('stats.losing_month', 0));
    }

    public function test_dashboard_uses_a_bounded_number_of_queries(): void
    {
        $this->buildOperation();

        DB::flushQueryLog();
        DB::enableQueryLog();

        $this->actingAs($this->admin)->get(route('dashboard'))->assertOk();

        // Sesión + usuario + rol/oficina + 5 consultas de indicadores; sin N+1.
        $this->assertLessThanOrEqual(12, count(DB::getQueryLog()));
    }
}
