import { Head, Link, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { Pill } from '@/components/app/badges';
import { FilterBar, FilterField } from '@/components/app/filter-bar';
import { Page, PageHeader, Panel } from '@/components/app/page';
import { Pagination } from '@/components/app/pagination';
import {
    CYCLE_STATUS,
    RouteClientCard,
} from '@/components/app/route-client-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useCan } from '@/hooks/use-can';
import { date } from '@/lib/format';
import { WEEK_DAYS } from '@/lib/route-tools';
import { cn } from '@/lib/utils';
import clients from '@/routes/clients';
import type { Client, IdName, MoveClient, Paginated } from '@/types';

type Filters = { search?: string; route_id?: string; day?: string };

export default function ClientsIndex({
    clients: page,
    filters,
    routes,
    today,
    week,
    moveClients,
}: {
    clients: Paginated<Client>;
    filters: Filters;
    routes: IdName[];
    today: number;
    week: { from: string; to: string };
    moveClients: MoveClient[];
}) {
    const can = useCan();
    const selectedDay = filters.day ? Number(filters.day) : null;

    const selectDay = (day: number | null) => {
        const query: Record<string, string> = {};

        if (filters.search) {
            query.search = filters.search;
        }

        if (filters.route_id) {
            query.route_id = filters.route_id;
        }

        if (day !== null) {
            query.day = String(day);
        }

        router.get(clients.index().url, query, {
            preserveState: true,
            replace: true,
        });
    };

    return (
        <Page>
            <Head title="Clientes" />
            <PageHeader
                title="Clientes"
                description={`Ruta de cobro · semana del ${date(week.from)} al ${date(week.to)}. Elija el día para ver los clientes que tocan.`}
                actions={
                    can('clients.manage') && (
                        <Button asChild>
                            <Link href={clients.create()}>
                                <Plus /> Nuevo cliente
                            </Link>
                        </Button>
                    )
                }
            />

            <Panel>
                <div className="space-y-4 p-4">
                    <div
                        className="flex gap-1.5 overflow-x-auto pb-1"
                        role="group"
                        aria-label="Día de corte"
                    >
                        <DayButton
                            active={selectedDay === null}
                            onClick={() => selectDay(null)}
                        >
                            Todos
                        </DayButton>
                        {WEEK_DAYS.map((d) => (
                            <DayButton
                                key={d.value}
                                active={selectedDay === d.value}
                                today={today === d.value}
                                onClick={() => selectDay(d.value)}
                                title={d.label}
                            >
                                {d.short}
                            </DayButton>
                        ))}
                    </div>

                    <FilterBar url={clients.index().url}>
                        <input
                            type="hidden"
                            name="day"
                            value={filters.day ?? ''}
                        />
                        <FilterField label="Buscar">
                            <Input
                                name="search"
                                defaultValue={filters.search}
                                placeholder="Nombre, negocio, documento"
                                className="w-64"
                            />
                        </FilterField>
                        <FilterField label="Ruta">
                            <NativeSelect
                                name="route_id"
                                defaultValue={filters.route_id ?? ''}
                                className="w-56"
                            >
                                <option value="">Todas</option>
                                {routes.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}
                                    </option>
                                ))}
                            </NativeSelect>
                        </FilterField>
                    </FilterBar>

                    <div className="flex flex-wrap gap-2 text-xs">
                        {(['done', 'partial', 'pending'] as const).map((s) => (
                            <Pill key={s} tone={CYCLE_STATUS[s].tone}>
                                {CYCLE_STATUS[s].label}
                            </Pill>
                        ))}
                    </div>
                </div>
            </Panel>

            {page.data.length === 0 ? (
                <Panel className="p-8 text-center text-sm text-muted-foreground">
                    {selectedDay
                        ? 'No hay clientes asignados a este día.'
                        : 'No hay clientes para mostrar.'}
                </Panel>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {page.data.map((client) => (
                        <RouteClientCard
                            key={client.id}
                            client={client}
                            moveClients={moveClients}
                        />
                    ))}
                </div>
            )}

            <Pagination page={page} />
        </Page>
    );
}

function DayButton({
    active,
    today,
    onClick,
    title,
    children,
}: {
    active: boolean;
    today?: boolean;
    onClick: () => void;
    title?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            title={title}
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'relative min-w-12 shrink-0 rounded-md border px-3 py-2 text-sm font-medium',
                active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted',
            )}
        >
            {children}
            {today && (
                <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
            )}
        </button>
    );
}

ClientsIndex.layout = {
    breadcrumbs: [{ title: 'Clientes', href: clients.index() }],
};
