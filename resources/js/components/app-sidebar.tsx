import { Link } from '@inertiajs/react';
import {
    Banknote,
    BarChart3,
    Building2,
    Gamepad2,
    HandCoins,
    LayoutGrid,
    Receipt,
    Route as RouteIcon,
    ShieldCheck,
    Store,
    Users,
    WifiOff,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCan } from '@/hooks/use-can';
import { dashboard, offline } from '@/routes';
import clients from '@/routes/clients';
import collections from '@/routes/collections';
import expenses from '@/routes/expenses';
import loans from '@/routes/loans';
import machines from '@/routes/machines';
import offices from '@/routes/offices';
import reports from '@/routes/reports';
import roles from '@/routes/roles';
import routes from '@/routes/routes';
import users from '@/routes/users';
import type { NavItem } from '@/types';

type GuardedItem = NavItem & { permission?: string };

const groups: { label: string; items: GuardedItem[] }[] = [
    {
        label: 'General',
        items: [
            { title: 'Panel', href: dashboard(), icon: LayoutGrid },
            {
                title: 'Reportes',
                href: reports.index(),
                icon: BarChart3,
                permission: 'reports.view',
            },
        ],
    },
    {
        label: 'Operación',
        items: [
            {
                title: 'Cortes',
                href: collections.index(),
                icon: Banknote,
                permission: 'collections.view',
            },
            {
                title: 'Clientes',
                href: clients.index(),
                icon: Store,
                permission: 'clients.view',
            },
            {
                title: 'Máquinas',
                href: machines.index(),
                icon: Gamepad2,
                permission: 'machines.view',
            },
            {
                title: 'Préstamos',
                href: loans.index(),
                icon: HandCoins,
                permission: 'loans.view',
            },
            {
                title: 'Gastos',
                href: expenses.index(),
                icon: Receipt,
                permission: 'expenses.view',
            },
            {
                title: 'Sin conexión',
                href: offline(),
                icon: WifiOff,
                permission: 'collections.create',
            },
        ],
    },
    {
        label: 'Administración',
        items: [
            {
                title: 'Oficinas',
                href: offices.index(),
                icon: Building2,
                permission: 'offices.view',
            },
            {
                title: 'Rutas',
                href: routes.index(),
                icon: RouteIcon,
                permission: 'routes.view',
            },
            {
                title: 'Usuarios',
                href: users.index(),
                icon: Users,
                permission: 'users.view',
            },
            {
                title: 'Roles',
                href: roles.index(),
                icon: ShieldCheck,
                permission: 'roles.view',
            },
        ],
    },
];

export function AppSidebar() {
    const can = useCan();

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {groups.map((group) => {
                    const items = group.items.filter(
                        (item) => !item.permission || can(item.permission),
                    );

                    return items.length > 0 ? (
                        <NavMain
                            key={group.label}
                            label={group.label}
                            items={items}
                        />
                    ) : null;
                })}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
