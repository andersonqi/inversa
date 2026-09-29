<?php

namespace App\Http\Controllers;

use App\Enums\ExpenseCategory;
use App\Models\Expense;
use App\Models\Machine;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ExpenseController extends Controller
{
    public function index(Request $request): Response
    {
        $from = $request->date('from')?->toDateString() ?? now()->startOfMonth()->toDateString();
        $to = $request->date('to')?->toDateString() ?? now()->toDateString();

        $query = Expense::query()
            ->visibleTo($request->user())
            ->whereBetween('spent_on', [$from, $to])
            ->when($request->integer('office_id'), fn ($q, $officeId) => $q->where('office_id', $officeId))
            ->when($request->string('category')->value(), fn ($q, $category) => $q->where('category', $category));

        return Inertia::render('expenses/index', [
            'expenses' => (clone $query)
                ->with(['office:id,name', 'collectionRoute:id,code', 'machine:id,code', 'user:id,name'])
                ->latest('spent_on')
                ->latest('id')
                ->paginate(25)
                ->withQueryString(),
            'total' => (clone $query)->sum('amount'),
            'byCategory' => $query->selectRaw('category, sum(amount) as total')->groupBy('category')->orderByDesc('total')->get(),
            'filters' => ['from' => $from, 'to' => $to, ...$request->only('office_id', 'category')],
            'offices' => $this->officeOptions($request->user()),
            'categories' => ExpenseCategory::options(),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('expenses/form', $this->formProps($request, null));
    }

    public function store(Request $request): RedirectResponse
    {
        Expense::create([...$this->validated($request), 'user_id' => $request->user()->id]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Gasto registrado.']);

        return to_route('expenses.index');
    }

    public function edit(Request $request, Expense $expense): Response
    {
        $this->ensureVisible($request, $expense);

        return Inertia::render('expenses/form', $this->formProps($request, $expense));
    }

    public function update(Request $request, Expense $expense): RedirectResponse
    {
        $this->ensureVisible($request, $expense);

        $expense->update($this->validated($request));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Gasto actualizado.']);

        return to_route('expenses.index');
    }

    public function destroy(Request $request, Expense $expense): RedirectResponse
    {
        $this->ensureVisible($request, $expense);

        $expense->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Gasto eliminado.']);

        return to_route('expenses.index');
    }

    /**
     * @return array<string, mixed>
     */
    private function formProps(Request $request, ?Expense $expense): array
    {
        return [
            'expense' => $expense,
            'offices' => $this->officeOptions($request->user()),
            'routes' => $this->routeOptions($request->user()),
            'machines' => Machine::query()->visibleTo($request->user())->orderBy('code')->get(['id', 'code', 'office_id']),
            'categories' => ExpenseCategory::options(),
            'today' => now()->toDateString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'office_id' => ['required', 'integer', 'exists:offices,id'],
            'collection_route_id' => ['nullable', 'integer', Rule::exists('collection_routes', 'id')->where('office_id', $request->integer('office_id'))],
            'machine_id' => ['nullable', 'integer', Rule::exists('machines', 'id')->where('office_id', $request->integer('office_id'))],
            'category' => ['required', Rule::enum(ExpenseCategory::class)],
            'amount' => ['required', 'numeric', 'gt:0'],
            'spent_on' => ['required', 'date', 'before_or_equal:today'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $this->ensureOfficeAllowed($request->user(), $data['office_id']);

        return $data;
    }
}
