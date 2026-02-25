"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, BarChart2, ClipboardList, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
    { name: "Addresses", href: "/addresses", icon: MapPin },
    { name: "Stats", href: "/stats", icon: BarChart2 },
    { name: "Logs", href: "/logs", icon: ClipboardList },
    { name: "Calendar", href: "/calendar", icon: CalendarDays },
];

export function BottomNav() {
    const pathname = usePathname();

    // Highlight active tab
    const isActive = (href: string) => {
        return pathname.startsWith(href);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 h-[80px] bg-background/80 backdrop-blur-lg border-t border-border flex justify-around items-center safe-area-bottom pb-safe">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = isActive(tab.href);
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className={cn(
                            "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                            active ? "text-primary" : "text-muted-foreground hover:text-primary/70"
                        )}
                    >
                        <Icon className={cn("w-6 h-6", active && "animate-pulse duration-1000")} strokeWidth={active ? 2.5 : 2} />
                        <span className="text-[10px] font-semibold tracking-wider uppercase">
                            {tab.name}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
