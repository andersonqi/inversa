import { Form, Head, Link } from '@inertiajs/react';
import { Ban, Check, Trash2 } from 'lucide-react';
import { LoanStatusBadge } from '@/components/app/badges';
import { ConfirmAction } from '@/components/app/confirm-action';
import { EmptyRow } from '@/components/app/empty-row';
import { Field } from '@/components/app/field';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Pagination } from '@/components/app/pagination';
import { StatCard } from '@/components/app/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { date, money, percent } from '@/lib/format';
import clients from '@/routes/clients';
import collections from '@/routes/collections';
import loans from '@/routes/loans';
import payments from '@/routes/loans/payments';
import type { Loan, LoanPayment, Paginated } from '@/types';

type Installment = {
    number: number;
    due_on: string;
    amount: number;
    covered: boolean;
};

export default function LoanShow({
    loan,
    payments: paymentsPage,
    schedule,
    arrears,
    today,
}: {
    loan: Loan;
    payments: Paginated<LoanPayment>;
    schedule: Installment[];
    arrears: number;
    today: string;
}) {
    const can = useCan();
    const paid = Number(loan.total) - Number(loan.balance);

    return (
        <Page>
            <Head title={`Préstamo #${loan.id}`} />
            <PageHeader
                title={`Préstamo #${loan.id}`}
                description={
                    <span className="flex flex-wrap items-center gap-2">
                        <LoanStatusBadge status={loan.status} />
                        <Link
                            href={clients.show(loan.client_id)}
                            className="underline underline-offset-4"
                        >
                            {loan.client?.name}
                        </Link>
                        · Desembolsado el {date(loan.issued_on)} ·{' '}
                        {loan.office?.name} · Otorgó {loan.user?.name}
                    </span>
                }
                actions={
                    can('loans.manage') &&
                    loan.status === 'active' && (
                        <ConfirmAction
                            url={loans.cancel(loan.id).url}
                            method="post"
                            title="¿Anular este préstamo?"
                            description="El préstamo deja de cobrarse. Los abonos registrados se conservan."
                            confirmLabel="Anular préstamo"
                            trigger={
                                <Button variant="outline">
                                    <Ban /> Anular
                                </Button>
                            }
                        />
                    )
                }
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Capital"
                    value={money(loan.principal)}
                    hint={`Interés ${percent(loan.interest_percent)} · total ${money(loan.total)}`}
                />
                <StatCard label="Pagado" value={money(paid)} tone="positive" />
                <StatCard label="Saldo" value={money(loan.balance)} />
                <StatCard
                    label="En mora"
                    value={money(arrears)}
                    tone={arrears > 0 ? 'negative' : 'default'}
                    hint={`Cuota ${money(loan.installment_amount)}`}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
                <div className="space-y-6">
                    {can('loans.pay') && loan.status === 'active' && (
                        <Panel title="Registrar abono">
                            <Form
                                {...payments.store.form(loan.id)}
                                resetOnSuccess
                                className="grid gap-4 p-4 sm:grid-cols-2"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <Field
                                            label="Monto"
                                            htmlFor="amount"
                                            error={errors.amount}
                                        >
                                            <Input
                                                id="amount"
                                                name="amount"
                                                type="number"
                                                step="0.01"
                                                min={0.01}
                                                max={loan.balance}
                                                defaultValue={Math.min(
                                                    Number(
                                                        loan.installment_amount,
                                                    ),
                                                    Number(loan.balance),
                                                )}
                                                required
                                            />
                                        </Field>
                                        <Field
                                            label="Fecha"
                                            htmlFor="paid_on"
                                            error={errors.paid_on}
                                        >
                                            <Input
                                                id="paid_on"
                                                name="paid_on"
                                                type="date"
                                                max={today}
                                                defaultValue={today}
                                                required
                                            />
                                        </Field>
                                        <Field
                                            label="Nota"
                                            htmlFor="notes"
                                            error={errors.notes}
                                            className="sm:col-span-2"
                                        >
                                            <Input id="notes" name="notes" />
                                        </Field>
                                        <div>
                                            <Button disabled={processing}>
                                                Registrar abono
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </Form>
                        </Panel>
                    )}

                    <Panel title="Plan de cuotas">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Vence</TableHead>
                                    <TableHead className="text-right">
                                        Cuota
                                    </TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {schedule.map((i) => {
                                    const overdue =
                                        !i.covered && i.due_on <= today;

                                    return (
                                        <TableRow key={i.number}>
                                            <TableCell className="tabular-nums">
                                                {i.number}
                                            </TableCell>
                                            <TableCell>
                                                {date(i.due_on)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {money(i.amount)}
                                            </TableCell>
                                            <TableCell>
                                                {i.covered ? (
                                                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                                                        <Check className="size-3" />{' '}
                                                        Cubierta
                                                    </span>
                                                ) : overdue ? (
                                                    <span className="text-xs text-red-600 dark:text-red-400">
                                                        Vencida
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">
                                                        Pendiente
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </Panel>
                </div>

                <Panel title="Abonos">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Origen</TableHead>
                                <TableHead>Registró</TableHead>
                                <TableHead className="text-right">
                                    Monto
                                </TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paymentsPage.data.length === 0 && (
                                <EmptyRow colSpan={5}>Sin abonos.</EmptyRow>
                            )}
                            {paymentsPage.data.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>{date(p.paid_on)}</TableCell>
                                    <TableCell className="text-xs">
                                        {p.collection_id ? (
                                            <Link
                                                href={collections.show(
                                                    p.collection_id,
                                                )}
                                                className="underline-offset-4 hover:underline"
                                            >
                                                Corte #{p.collection_id}
                                            </Link>
                                        ) : (
                                            p.notes || 'Abono directo'
                                        )}
                                    </TableCell>
                                    <TableCell>{p.user?.name}</TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        {money(p.amount)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {can('loans.manage') &&
                                            !p.collection_id && (
                                                <ConfirmAction
                                                    url={
                                                        payments.destroy({
                                                            loan: loan.id,
                                                            payment: p.id,
                                                        }).url
                                                    }
                                                    title="¿Eliminar este abono?"
                                                    description="El saldo del préstamo se recalcula."
                                                    trigger={
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label="Eliminar"
                                                        >
                                                            <Trash2 />
                                                        </Button>
                                                    }
                                                />
                                            )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <Pagination page={paymentsPage} />
                </Panel>
            </div>
        </Page>
    );
}

LoanShow.layout = {
    breadcrumbs: [
        { title: 'Préstamos', href: loans.index() },
        { title: 'Detalle', href: '#' },
    ],
};
