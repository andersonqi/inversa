import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    CalendarCheck,
    HandCoins,
    Route as RouteIcon,
} from 'lucide-react';
import { Page, PageHeader } from '@/components/app/page';
import reports from '@/routes/reports';

const items = [
    {
        title: 'Cuadre diario',
        description:
            'Cortes por ruta, gastos, préstamos y efectivo neto de un día.',
        href: reports.daily(),
        icon: CalendarCheck,
    },
    {
        title: 'Máquinas perdedoras',
        description:
            'Rendimiento por máquina en un período: jugado, pagado, retorno y ganancia neta.',
        href: reports.machines(),
        icon: AlertTriangle,
    },
    {
        title: 'Rentabilidad por ruta',
        description: 'Ganancia de la empresa por ruta menos sus gastos.',
        href: reports.routes(),
        icon: RouteIcon,
    },
    {
        title: 'Cartera y mora',
        description:
            'Préstamos activos, saldos, cuotas vencidas y último abono.',
        href: reports.loans(),
        icon: HandCoins,
    },
];

export default function ReportsIndex() {
    return (
        <Page>
            <Head title="Reportes" />
            <PageHeader title="Reportes" />
            <div className="grid gap-4 md:grid-cols-2">
                {items.map((item) => (
                    <Link
                        key={item.title}
                        href={item.href}
                        className="group flex gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                        <item.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                        <div>
                            <p className="font-semibold">{item.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {item.description}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </Page>
    );
}

ReportsIndex.layout = {
    breadcrumbs: [{ title: 'Reportes', href: reports.index() }],
};
