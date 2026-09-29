import { usePage } from '@inertiajs/react';

import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <>
            <span className="flex size-8 shrink-0">
                <AppLogoIcon className="size-8" />
            </span>
            <div className="ml-1 grid flex-1 text-left">
                <span className="truncate font-display text-lg leading-tight font-semibold tracking-tight text-sidebar-foreground">
                    {name}
                </span>
            </div>
        </>
    );
}
