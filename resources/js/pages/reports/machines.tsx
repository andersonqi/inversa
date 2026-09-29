import { Head, Link } from '@inertiajs/react';
import { EmptyRow } from '@/components/app/empty-row';
import { FilterBar, FilterField } from '@/components/app/filter-bar';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Pagination } from '@/components/app/pagination';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { money, percent, signClass } from '@/lib/format';
import machines from '@/routes/machines';
import reports from '@/routes/reports';
import type { IdName, Paginated } from '@/types';

type Row = {
    id: number;
    code: string;
    brand: string | null;
    model: string | null;
    client_name: string | null;
    route_code: string | null;
    readings: number;
    amount_in: string;
    amount_out: string;
    net: string;
    payout_percent: string;
};

export default function MachinesReport({
    filters,
    offices,
    rows: page,
    summary,
}: {
    filters: {
        from: string;
        to: string;
        office_id: number | null;
        only_losing: boolean;
    };
    offices: IdName[];
    rows: Paginated<Row>;
    summary: { machines: number; net: number };
}) {
    return (
        <Page>
            <Head title="Máquinas perdedoras" />
            <PageHeader
                title={
                    filters.only_losing
                        ? 'Máquinas perdedoras'
                        : 'Rendimiento de máquinas'
                }
                description="Una máquina es perdedora cuando en el período pagó más de lo que recibió (retorno mayor a 100%)."
            />

            <FilterBar url={reports.machines().url}>
                <FilterField label="Desde">
                    <Input
                        type="date"
                        name="from"
                        defaultValue={filters.from}
                        className="w-40"
                    />
                </FilterField>
                <FilterField label="Hasta">
                    <Input
                        type="date"
                        name="to"
                        defaultValue={filters.to}
                        className="w-40"
                    />
                </FilterField>
                <FilterField label="Oficina">
                    <NativeSelect
                        name="office_id"
                        defaultValue={filters.office_id ?? ''}
                        className="w-52"
                    >
                        <option value="">Todas</option>
                        {offices.map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.name}
                            </option>
                        ))}
                    </NativeSelect>
                </FilterField>
                <div className="pb-2">
                    <OnlyLosingToggle defaultChecked={filters.only_losing} />
                </div>
            </FilterBar>

            <Panel
                title={`${summary.machines} máquinas · neto ${money(summary.net)}`}
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Máquina</TableHead>
                            <TableHead>Ubicación</TableHead>
                            <TableHead className="text-right">Cortes</TableHead>
                            <TableHead className="text-right">Jugado</TableHead>
                            <TableHead className="text-right">Pagado</TableHead>
                            <TableHead className="text-right">
                                Retorno
                            </TableHead>
                            <TableHead className="text-right">Neto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.data.length === 0 && (
                            <EmptyRow colSpan={7}>
                                Sin resultados en el período.
                            </EmptyRow>
                        )}
                        {page.data.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>
                                    <Link
                                        href={machines.show(r.id)}
                                        className="font-mono text-xs font-medium underline-offset-4 hover:underline"
                                    >
                                        {r.code}
                                    </Link>
                                    <p className="text-xs text-muted-foreground">
                                        {[r.brand, r.model]
                                            .filter(Boolean)
                                            .join(' ')}
                                    </p>
                                </TableCell>
                                <TableCell>
                                    {r.client_name ?? '—'}
                                    {r.route_code && (
                                        <span className="text-xs text-muted-foreground">
                                            {' '}
                                            · {r.route_code}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {r.readings}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.amount_in)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.amount_out)}
                                </TableCell>
                                <TableCell
                                    className={`text-right tabular-nums ${Number(r.payout_percent) > 100 ? 'text-red-600 dark:text-red-400' : ''}`}
                                >
                                    {percent(r.payout_percent)}
                                </TableCell>
                                <TableCell
                                    className={`text-right font-medium tabular-nums ${signClass(r.net)}`}
                                >
                                    {money(r.net)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Pagination page={page} />
            </Panel>
        </Page>
    );
}

/** El campo oculto envía 0 cuando el checkbox está desmarcado; si está marcado, el 1 lo sobrescribe. */
function OnlyLosingToggle({ defaultChecked }: { defaultChecked: boolean }) {
    return (
        <label className="flex items-center gap-2 text-sm">
            <input type="hidden" name="only_losing" value="0" />
            <input
                type="checkbox"
                name="only_losing"
                value="1"
                defaultChecked={defaultChecked}
                className="size-4 accent-primary"
            />
            Solo perdedoras
        </label>
    );
}

MachinesReport.layout = {
    breadcrumbs: [
        { title: 'Reportes', href: reports.index() },
        { title: 'Máquinas', href: reports.machines() },
    ],
};
