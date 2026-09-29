import { Head } from '@inertiajs/react';
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
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { money, signClass } from '@/lib/format';
import reports from '@/routes/reports';
import type { IdName, Paginated } from '@/types';

type Row = {
    id: number;
    code: string;
    name: string;
    office: string;
    collector: string | null;
    clients_count: number;
    machines_count: number;
    visits: number;
    net: number;
    client_share: number;
    company_share: number;
    expenses: number;
    profit: number;
};

export default function RoutesReport({
    filters,
    offices,
    rows: page,
    totals,
}: {
    filters: { from: string; to: string; office_id: number | null };
    offices: IdName[];
    rows: Paginated<Row>;
    totals: Pick<
        Row,
        | 'visits'
        | 'net'
        | 'client_share'
        | 'company_share'
        | 'expenses'
        | 'profit'
    >;
}) {
    return (
        <Page>
            <Head title="Rentabilidad por ruta" />
            <PageHeader
                title="Rentabilidad por ruta"
                description="Utilidad = parte de la empresa en los cortes − gastos asignados a la ruta."
            />

            <FilterBar url={reports.routes().url}>
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
            </FilterBar>

            <Panel>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Ruta</TableHead>
                            <TableHead>Oficina</TableHead>
                            <TableHead>Cobrador</TableHead>
                            <TableHead className="text-right">
                                Clientes
                            </TableHead>
                            <TableHead className="text-right">
                                Máquinas
                            </TableHead>
                            <TableHead className="text-right">Cortes</TableHead>
                            <TableHead className="text-right">Neto</TableHead>
                            <TableHead className="text-right">
                                Comisiones
                            </TableHead>
                            <TableHead className="text-right">
                                Empresa
                            </TableHead>
                            <TableHead className="text-right">Gastos</TableHead>
                            <TableHead className="text-right">
                                Utilidad
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.data.length === 0 && <EmptyRow colSpan={11} />}
                        {page.data.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>
                                    <span className="font-mono text-xs">
                                        {r.code}
                                    </span>{' '}
                                    {r.name}
                                </TableCell>
                                <TableCell>{r.office}</TableCell>
                                <TableCell>{r.collector ?? '—'}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {r.clients_count}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {r.machines_count}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {r.visits}
                                </TableCell>
                                <TableCell
                                    className={`text-right tabular-nums ${signClass(r.net)}`}
                                >
                                    {money(r.net)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.client_share)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.company_share)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(r.expenses)}
                                </TableCell>
                                <TableCell
                                    className={`text-right font-semibold tabular-nums ${signClass(r.profit)}`}
                                >
                                    {money(r.profit)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    {page.data.length > 0 && (
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={5}>
                                    Total del período
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {totals.visits}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(totals.net)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(totals.client_share)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(totals.company_share)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(totals.expenses)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {money(totals.profit)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    )}
                </Table>
                <Pagination page={page} />
            </Panel>
        </Page>
    );
}

RoutesReport.layout = {
    breadcrumbs: [
        { title: 'Reportes', href: reports.index() },
        { title: 'Rutas', href: reports.routes() },
    ],
};
