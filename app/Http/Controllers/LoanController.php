<?php

namespace App\Http\Controllers;

use App\Enums\LoanFrequency;
use App\Enums\LoanStatus;
use App\Models\Client;
use App\Models\Loan;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class LoanController extends Controller
{
    public function index(Request $request): Response
    {
        $status = $request->string('status', LoanStatus::Active->value)->value();

        $loans = Loan::query()
            ->visibleTo($request->user())
            ->with(['client:id,name,collection_route_id', 'client.collectionRoute:id,code'])
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->when($request->string('search')->value(), fn ($q, $search) => $q->whereHas('client', fn ($c) => $c->whereAny(['name', 'business_name', 'document'], 'ilike', "%{$search}%")))
            ->latest('issued_on')
            ->latest('id')
            ->paginate(25)
            ->withQueryString();

        $today = CarbonImmutable::today();
        $loans->getCollection()->each(fn (Loan $loan) => $loan->setAttribute('arrears', $loan->status === LoanStatus::Active ? $loan->arrearsAt($today) : 0));

        return Inertia::render('loans/index', [
            'loans' => $loans,
            'filters' => ['status' => $status, ...$request->only('search')],
            'statuses' => LoanStatus::options(),
            'frequencies' => LoanFrequency::options(),
            'portfolio' => Loan::query()->visibleTo($request->user())->where('status', LoanStatus::Active)
                ->selectRaw('count(*) as count, coalesce(sum(balance), 0) as balance')->first(),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('loans/create', [
            'clients' => Client::query()
                ->visibleTo($request->user())
                ->where('is_active', true)
                ->with('collectionRoute:id,code')
                ->orderBy('name')
                ->get(['id', 'name', 'collection_route_id'])
                ->map(fn (Client $c) => ['id' => $c->id, 'name' => "{$c->name} ({$c->collectionRoute->code})"]),
            'frequencies' => LoanFrequency::options(),
            'clientId' => $request->integer('client_id') ?: null,
            'today' => now()->toDateString(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'principal' => ['required', 'numeric', 'gt:0'],
            'interest_percent' => ['required', 'numeric', 'min:0', 'max:1000'],
            'frequency' => ['required', Rule::enum(LoanFrequency::class)],
            'installments' => ['required', 'integer', 'min:1', 'max:365'],
            'issued_on' => ['required', 'date'],
            'first_due_on' => ['required', 'date', 'after_or_equal:issued_on'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $client = Client::query()->visibleTo($request->user())->with('collectionRoute')->findOrFail($request->integer('client_id'));

        $total = round($data['principal'] * (1 + $data['interest_percent'] / 100), 2);

        $loan = Loan::create([
            ...$data,
            'office_id' => $client->collectionRoute->office_id,
            'user_id' => $request->user()->id,
            'total' => $total,
            'balance' => $total,
            'installment_amount' => round($total / $data['installments'], 2),
            'status' => LoanStatus::Active,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Préstamo otorgado.']);

        return to_route('loans.show', $loan);
    }

    public function show(Request $request, Loan $loan): Response
    {
        $this->ensureVisible($request, $loan);

        $loan->load(['client:id,name,business_name', 'user:id,name', 'office:id,name']);

        $paid = (float) $loan->total - (float) $loan->balance;
        $schedule = [];

        for ($i = 0; $i < $loan->installments; $i++) {
            $cumulative = min((float) $loan->total, ($i + 1) * (float) $loan->installment_amount);
            $schedule[] = [
                'number' => $i + 1,
                'due_on' => $loan->frequency->addPeriods($loan->first_due_on, $i)->toDateString(),
                'amount' => $i === $loan->installments - 1
                    ? round((float) $loan->total - $i * (float) $loan->installment_amount, 2)
                    : (float) $loan->installment_amount,
                'covered' => $paid + 0.001 >= $cumulative,
            ];
        }

        return Inertia::render('loans/show', [
            'loan' => $loan,
            'payments' => $loan->payments()->with('user:id,name')->latest('paid_on')->latest('id')->paginate(15)->withQueryString(),
            'schedule' => $schedule,
            'arrears' => $loan->status === LoanStatus::Active ? $loan->arrearsAt(CarbonImmutable::today()) : 0,
            'today' => now()->toDateString(),
        ]);
    }

    public function cancel(Request $request, Loan $loan): RedirectResponse
    {
        $this->ensureVisible($request, $loan);

        $loan->update(['status' => LoanStatus::Cancelled]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Préstamo anulado.']);

        return to_route('loans.show', $loan);
    }
}
