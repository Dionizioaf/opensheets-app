"use client";

import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SiteHeader } from "@/components/header-dashboard";
import type { DashboardNotificationsSnapshot } from "@/lib/dashboard/notifications";
import type { PagadorLike } from "./nav-link";

type AppUser = {
    id: string;
    name: string;
    email: string;
    image: string | null;
};

interface SidebarLayoutProps {
    user: AppUser;
    pagadorAvatarUrl: string | null;
    pagadores: PagadorLike[];
    notificationsSnapshot: DashboardNotificationsSnapshot;
    children: React.ReactNode;
}

export function SidebarLayout({
    user,
    pagadorAvatarUrl,
    pagadores,
    notificationsSnapshot,
    children,
}: SidebarLayoutProps) {
    // Client-side only rendering to avoid hydration issues with Radix UI IDs
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                        {children}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <SidebarProvider>
            <AppSidebar
                user={user}
                pagadorAvatarUrl={pagadorAvatarUrl}
                pagadores={pagadores}
                variant="inset"
            />
            <SidebarInset>
                <SiteHeader notificationsSnapshot={notificationsSnapshot} />
                <div className="flex flex-1 flex-col">
                    <div className="@container/main flex flex-1 flex-col gap-2">
                        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                            {children}
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
