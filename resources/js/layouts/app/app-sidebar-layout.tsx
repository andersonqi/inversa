import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { CurrencyBoundary } from '@/components/currency-switcher';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { OfflineManager } from '@/components/offline/offline-manager';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="min-w-0 overflow-x-clip">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                <OfflineManager />
                {/* Espacio para la barra inferior en el celular. */}
                <div className="flex flex-1 flex-col pb-24 md:pb-0">
                    <CurrencyBoundary>{children}</CurrencyBoundary>
                </div>
            </AppContent>
            <MobileBottomNav />
        </AppShell>
    );
}
