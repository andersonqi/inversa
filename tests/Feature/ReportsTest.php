<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsOperation;
use Tests\TestCase;

/**
 * Verifica los montos de los reportes contra la operación de prueba:
 * - Central: corte con neto ₡5.000 (cliente 30% = ₡1.500, empresa ₡3.500) y gasto de ruta ₡5.000.
 * - Norte: corte forzado con neto -₡1.000 (la pulpería asume 40% = ₡400, la empresa -₡600)
 *   y gasto general (sin ruta) de ₡80.000.
 */
class ReportsTest extends TestCase
{
    use BuildsOperation, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildOperation();
    }

    public function test_daily_report_balances_cash_for_all_offices(): void
    {
        $this->actingAs($this->admin)->get(route('reports.daily'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('reports/daily')
                ->has('byRoute', 2)
                ->has('losing', 1)
                ->where('summary.net', 4000)
                ->where('summary.cash_delivered', 2500)
                ->where('summary.expenses', 85000)
                ->where('summary.loans_issued', 0)
                ->where('summary.cash_balance', -82500));
    }

    public function test_daily_report_filters_by_office(): void
    {
        $this->actingAs($this->admin)->get(route('reports.daily', ['office_id' => $this->office->id]))
            ->assertInertia(fn (Assert $page) => $page
                ->has('byRoute', 1)
                ->has('losing', 0)
                ->where('summary.cash_delivered', 3500)
                ->where('summary.expenses', 5000)
                ->where('summary.cash_balance', -1500));
    }

    public function test_daily_report_counts_direct_loan_payments_and_new_loans(): void
    {
        $this->loan->payments()->create(['user_id' => $this->admin->id, 'amount' => 15000, 'paid_on' => now()->toDateString()]);
        $this->loan->refreshBalance();

        $this->actingAs($this->admin)->get(route('reports.daily', ['office_id' => $this->office->id]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('summary.loan_payments', 15000)
                ->where('summary.cash_balance', 3500 + 15000 - 5000));
    }

    public function test_supervisor_daily_report_ignores_other_offices(): void
    {
        $this->actingAs($this->supervisor)->get(route('reports.daily', ['office_id' => $this->otherOffice->id]))
            ->assertInertia(fn (Assert $page) => $page
                ->has('byRoute', 0)
                ->where('summary.expenses', 0));
    }

    public function test_losing_machines_report_lists_only_machines_with_losses(): void
    {
        $this->actingAs($this->admin)->get(route('reports.machines'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows.data', 1)
                ->where('rows.data.0.code', 'MAQ-2')
                ->where('rows.data.0.payout_percent', '300.00')
                ->where('summary.machines', 1)
                ->where('summary.net', -1000));

        $this->actingAs($this->admin)->get(route('reports.machines', ['only_losing' => 0]))
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows.data', 2)
                ->where('rows.data.0.code', 'MAQ-2')
                ->where('summary.net', 4000));
    }

    public function test_routes_report_subtracts_route_expenses(): void
    {
        $this->actingAs($this->admin)->get(route('reports.routes'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows.data', 2)
                ->where('rows.data.0.company_share', 3500)
                ->where('rows.data.0.expenses', 5000)
                ->where('rows.data.0.profit', -1500)
                ->where('totals.company_share', 2900)
                ->where('totals.profit', -2100));
    }

    public function test_loans_report_calculates_arrears(): void
    {
        // Préstamo semanal con primera cuota hace 2 semanas: 3 cuotas vencidas de ₡15.000 y nada pagado.
        $this->actingAs($this->admin)->get(route('reports.loans'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('rows.data', 1)
                ->where('rows.data.0.arrears', 45000)
                ->where('summary.count', 1)
                ->where('summary.balance', 120000)
                ->where('summary.arrears', 45000)
                ->where('summary.in_arrears', 1));
    }

    public function test_collector_cannot_open_reports(): void
    {
        $this->actingAs($this->collector)->get(route('reports.daily'))->assertForbidden();
    }
}
