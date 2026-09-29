<?php

namespace App\Http\Controllers;

use App\Enums\LoanStatus;
use App\Models\Loan;
use App\Models\LoanPayment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class LoanPaymentController extends Controller
{
    public function store(Request $request, Loan $loan): RedirectResponse
    {
        $this->ensureVisible($request, $loan);

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0', 'max:'.$loan->balance],
            'paid_on' => ['required', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:255'],
        ], [
            'amount.max' => 'El abono no puede superar el saldo pendiente.',
        ]);

        abort_unless($loan->status === LoanStatus::Active, 422, 'El préstamo no está activo.');

        DB::transaction(function () use ($loan, $data, $request) {
            $loan->payments()->create([...$data, 'user_id' => $request->user()->id]);
            $loan->refreshBalance();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Abono registrado.']);

        return to_route('loans.show', $loan);
    }

    public function destroy(Request $request, Loan $loan, LoanPayment $payment): RedirectResponse
    {
        $this->ensureVisible($request, $loan);
        abort_unless($payment->loan_id === $loan->id, 404);

        if ($payment->collection_id) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'Este abono proviene de un corte; anule el corte para revertirlo.']);

            return back();
        }

        DB::transaction(function () use ($loan, $payment) {
            $payment->delete();
            $loan->refreshBalance();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Abono eliminado.']);

        return to_route('loans.show', $loan);
    }
}
