"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, BarChart2, ClipboardList, CalendarDays, Navigation, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
    { name: "Addresses", href: "/addresses", icon: MapPin },
    { name: "Stats", href: "/stats", icon: BarChart2 },
    { name: "Route", href: "/route-planner", icon: Navigation },
    { name: "Logs", href: "/logs", icon: ClipboardList },
    { name: "Calendar", href: "/calendar", icon: CalendarDays },
    { name: "Profile", href: "/profile", icon: UserCircle },
];

export function BottomNav() {
    const pathname = usePathname();

    const isActive = (href: string) => pathname.startsWith(href);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 h-[92px] premium-glass glass-edge-highlight flex justify-around items-stretch safe-area-bottom pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = isActive(tab.href);
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className={cn(
                            "relative flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 ease-out active:scale-95 group",
                            active ? "text-primary" : "text-white/40 hover:text-white/70"
                        )}
                    >
                        {/* Glow Behind Active Icon */}
                        <div className={cn(
                            "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300",
                            active ? "opacity-100" : "opacity-0"
                        )}>
                            <div className="w-12 h-12 bg-primary/20 rounded-full blur-md" />
                        </div>

                        {/* Pill backdrop on active tab */}
                        <span
                            className={cn(
                                "absolute w-14 h-8 rounded-full transition-all duration-300 ease-out -z-10",
                                active ? "bg-primary/15 border border-primary/20 shrink-0 mt-[-20px]" : "bg-transparent scale-50 opacity-0"
                            )}
                        />

                        {/* Icon */}
                        <Icon
                            className={cn(
                                "relative z-10 transition-all duration-300 ease-out",
                                active ? "w-6 h-6 -translate-y-[10px] drop-shadow-[0_0_8px_rgba(195,255,0,0.6)]" : "w-6 h-6 group-hover:scale-110"
                            )}
                            strokeWidth={active ? 2.5 : 2}
                        />

                        {/* Label */}
                        <span className={cn(
                            "absolute font-bold tracking-wider uppercase transition-all duration-300",
                            active ? "bottom-3 text-[10px] opacity-100" : "bottom-0 text-[0px] opacity-0"
                        )}>
                            {tab.name}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
