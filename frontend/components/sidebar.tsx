"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
    LayoutDashboard,
    Users,
    FolderTree,
    Shield,
    Settings,
    Network,
    Menu,
    X,
    FileText
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/agents", label: "Agents", icon: Users },
    { href: "/groups", label: "Groups", icon: FolderTree },
    { href: "/policies", label: "Policies", icon: Shield },
    { href: "/audit-logs", label: "Audit Logs", icon: FileText },
];

function NavLink({ item, isActive, onClick }: {
    item: typeof navItems[0];
    isActive: boolean;
    onClick?: () => void;
}) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
        >
            <Icon className="h-4 w-4" />
            {item.label}
        </Link>
    );
}

export function Sidebar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const isActive = (href: string) => (
        pathname === href || (href !== "/" && pathname.startsWith(href))
    );

    const sidebarContent = (
        <>
            <div className="flex h-16 items-center gap-3 px-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg">
                    <Network className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex flex-col">
                    <span className="text-lg font-bold tracking-tight">Zero ZTA</span>
                    <span className="text-xs text-muted-foreground">Zero Trust Access</span>
                </div>
            </div>

            <nav className="flex flex-col gap-1 px-4 mt-4">
                {navItems.map((item) => (
                    <NavLink
                        key={item.href}
                        item={item}
                        isActive={isActive(item.href)}
                        onClick={() => setOpen(false)}
                    />
                ))}
            </nav>

            <div className="absolute bottom-0 left-0 right-0 border-t bg-background/50 backdrop-blur p-4 space-y-2">
                <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-muted-foreground">Theme</span>
                    <ThemeToggle />
                </div>
                <Link
                    href="/settings"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                    <Settings className="h-4 w-4" />
                    Settings
                </Link>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile Header */}
            <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur px-4 lg:hidden">
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="lg:hidden">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72 p-0">
                        <div className="relative h-full">{sidebarContent}</div>
                    </SheetContent>
                </Sheet>
                <div className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Zero ZTA</span>
                </div>
                <div className="ml-auto">
                    <ThemeToggle />
                </div>
            </header>

            {/* Desktop Sidebar */}
            <aside className="fixed inset-y-0 left-0 z-50 hidden w-72 border-r bg-background/50 backdrop-blur-xl lg:block">
                <div className="relative h-full">{sidebarContent}</div>
            </aside>
        </>
    );
}
