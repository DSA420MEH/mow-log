"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, BarChart2, ClipboardList, CalendarDays, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
    { name: "Addresses", href: "/addresses", icon: MapPin },
    { name: "Stats", href: "/stats", icon: BarChart2 },
    { name: "Route", href: "/route-planner", icon: Navigation },
    { name: "Logs", href: "/logs", icon: ClipboardList },
    { name: "Calendar", href: "/calendar", icon: CalendarDays },
];

export function BottomNav() {
    const pathname = usePathname();

    const isActive = (href: string) => pathname.startsWith(href);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 h-[80px] bg-background/90 backdrop-blur-xl border-t border-white/[0.06] flex justify-around items-stretch safe-area-bottom pb-safe">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = isActive(tab.href);
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className={cn(
                            "relative flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 ease-out active:scale-95",
                            active ? "text-primary" : "text-muted-foreground hover:text-primary/60"
                        )}
                    >
                        {/* Neon top-line indicator */}
                        <span
                            className={cn(
                                "absolute top-0 left-1/2 -translate-x-1/2 h-[2px] rounded-b-full transition-all duration-300 ease-out",
                                active
                                    ? "w-8 bg-primary shadow-[0_0_8px_rgba(195,255,0,0.8)]"
                                    : "w-0 bg-transparent"
                            )}
                        />

                        {/* Pill backdrop on active tab */}
                        <span
                            className={cn(
                                "absolute inset-x-2 top-2 bottom-2 rounded-xl transition-all duration-300 ease-out",
                                active ? "bg-primary/10" : "bg-transparent"
                            )}
                        />

                        {/* Icon */}
                        <Icon
                            className={cn(
                                "relative z-10 transition-all duration-200 ease-out",
                                active ? "w-[22px] h-[22px] scale-110" : "w-[22px] h-[22px] scale-100"
                            )}
                            strokeWidth={active ? 2.5 : 2}
                        />

                        {/* Label */}
                        <span className="relative z-10 text-[10px] font-semibold tracking-wider uppercase">
                            {tab.name}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
