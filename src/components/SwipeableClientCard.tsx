"use client";

import { useState, useRef, useCallback } from "react";
import { MapPin, Pencil, Timer, Route, TrendingUp, TrendingDown, BarChart3, Clock, Zap, PauseCircle, Calendar, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ClientData {
    id: string;
    name: string;
    address: string;
    phone?: string;
    sqft?: string;
    billingType: string;
    amount: number;
    lat?: number;
    lng?: number;
    routeScreenshot?: string;
}

interface ClientStats {
    totalVisits: number;
    totalTimeStr: string;
    avgTime: string;
    daysSince: string;
    daysSinceNum: number;
    totalStuckStr: string;
    totalBreakStr: string;
}

interface ProfitData {
    revenue: number;
    profit: number;
}

interface ActiveSessionData {
    startTime: string;
    breakTimeTotal?: number;
    stuckTimeTotal?: number;
    currentBreakOrStuckStartTime?: string | null;
    status: string;
    endTime: string | null;
}

interface SwipeableClientCardProps {
    client: ClientData;
    stats: ClientStats;
    profit: ProfitData;
    isActiveMowing: boolean;
    activeSession?: ActiveSessionData | null;
    avatarStyle: { bg: string; text: string };
    onStartMowing: () => void;
    onCompleteMowing: () => void;
    InlineMowTimer: React.ComponentType<{
        startTime: string;
        breakTimeTotal?: number;
        stuckTimeTotal?: number;
        status: string;
        endTime: string | null;
        currentBreakOrStuckStartTime?: string | null;
    }>;
}

// ── Swipe Dot Indicator ────────────────────────────────────────────────────────
function SwipeDots({ count, active }: { count: number; active: number }) {
    return (
        <div className="flex items-center justify-center gap-2 py-2.5">
            {Array.from({ length: count }).map((_, i) => (
                <button
                    key={i}
                    aria-label={`Go to panel ${i + 1}`}
                    className={cn(
                        "rounded-full transition-all duration-300",
                        i === active
                            ? "w-6 h-2 bg-primary shadow-[0_0_8px_rgba(170,255,0,0.4)]"
                            : "w-2 h-2 bg-white/20 hover:bg-white/30"
                    )}
                />
            ))}
        </div>
    );
}

// ── Panel Labels ───────────────────────────────────────────────────────────────
const PANEL_LABELS = ["Info", "Stats", "Route"];

// ── Main Component ─────────────────────────────────────────────────────────────
export function SwipeableClientCard({
    client,
    stats,
    profit,
    isActiveMowing,
    activeSession,
    avatarStyle,
    onStartMowing,
    onCompleteMowing,
    InlineMowTimer,
}: SwipeableClientCardProps) {
    const [activePanel, setActivePanel] = useState(0);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const isSwiping = useRef(false);

    const panelCount = 3;

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        isSwiping.current = false;
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const dx = e.touches[0].clientX - touchStartX.current;
        const dy = e.touches[0].clientY - touchStartY.current;
        // If horizontal movement exceeds vertical, it's a swipe
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
            isSwiping.current = true;
        }
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!isSwiping.current) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const threshold = 40;
        if (dx < -threshold && activePanel < panelCount - 1) {
            setActivePanel((p) => p + 1);
        } else if (dx > threshold && activePanel > 0) {
            setActivePanel((p) => p - 1);
        }
    }, [activePanel, panelCount]);

    const getInitials = (name: string) =>
        name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);

    const [street, cityZip] = client.address.split(", ");

    let daysSinceColor = "text-primary bg-primary/10";
    if (stats.daysSinceNum > 10) daysSinceColor = "text-rose-400 bg-rose-500/10";
    else if (stats.daysSinceNum > 5) daysSinceColor = "text-orange-400 bg-orange-500/10";

    const isPositive = profit.profit >= 0;
    const fmtMoney = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(0);
    const showProfit = profit.revenue !== 0 || profit.profit !== 0;

    return (
        <div
            className={cn(
                "glass-card rounded-2xl bg-[#1a201c] border relative overflow-hidden flex flex-col transition-colors",
                isActiveMowing
                    ? "border-primary shadow-[0_0_15px_rgba(170,255,0,0.1)]"
                    : "border-white/5 hover:border-primary/20"
            )}
        >
            {/* Active mowing indicator */}
            {isActiveMowing && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-70 z-20"></div>
            )}

            {/* Panel label tab */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <div className="flex items-center gap-1.5">
                    {PANEL_LABELS.map((label, i) => (
                        <button
                            key={label}
                            onClick={() => setActivePanel(i)}
                            className={cn(
                                "text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md transition-all duration-200",
                                i === activePanel
                                    ? "text-primary bg-primary/10"
                                    : "text-muted-foreground/50 hover:text-muted-foreground"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <button className="text-muted-foreground hover:text-white transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Swipeable panels container */}
            <div
                className="swipe-container flex-1"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    className="swipe-track"
                    style={{ transform: `translateX(-${activePanel * 100}%)` }}
                >
                    {/* ═══ Panel 0: Info ═══ */}
                    <div className="swipe-panel p-4 pt-2">
                        {/* Client Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex gap-3 items-start">
                                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base", avatarStyle.bg, avatarStyle.text)}>
                                    {getInitials(client.name)}
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white leading-none mb-1">{client.name}</h3>
                                    <div className="text-xs text-muted-foreground flex items-start gap-1">
                                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                        <div className="flex flex-col leading-tight">
                                            <span className="text-gray-300">{street || client.address}</span>
                                            {cityZip && <span className="text-[10px] mt-0.5 opacity-70 uppercase tracking-wider">{cityZip}</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Profit Badge */}
                        {showProfit && (
                            <div className="flex items-center gap-2 mb-3">
                                <div className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold",
                                    isPositive ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                                )}>
                                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {fmtMoney(profit.profit)}
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                    {client.billingType === "Regular" ? `$${client.amount}/mo` : `$${client.amount}/cut`}
                                </span>
                            </div>
                        )}

                        {/* Active Mowing Timer */}
                        {isActiveMowing && activeSession && (
                            <div className="mb-3 py-2 border-y border-primary/20 flex items-center justify-center gap-2">
                                <Timer className="w-4 h-4 text-primary animate-pulse" />
                                <span className="text-sm font-bold text-primary tracking-widest uppercase">Mowing Now - </span>
                                <span className="text-sm font-bold font-mono text-white">
                                    <InlineMowTimer
                                        startTime={activeSession.startTime}
                                        breakTimeTotal={activeSession.breakTimeTotal}
                                        stuckTimeTotal={activeSession.stuckTimeTotal}
                                        currentBreakOrStuckStartTime={activeSession.currentBreakOrStuckStartTime}
                                        status={activeSession.status}
                                        endTime={activeSession.endTime}
                                    />
                                </span>
                            </div>
                        )}

                        {/* Quick Stats Row */}
                        <div className="grid grid-cols-2 gap-px bg-white/5 rounded-xl overflow-hidden mb-3 border border-white/5 text-sm">
                            <div className="bg-[#151a17] p-2.5 flex flex-col justify-center">
                                <span className="text-[10px] text-primary/70 font-bold tracking-wider mb-0.5 uppercase">Phone</span>
                                <span className="text-gray-200 font-medium text-sm">{client.phone || "N/A"}</span>
                            </div>
                            <div className="bg-[#151a17] p-2.5 flex flex-col justify-center overflow-hidden">
                                <span className="text-[10px] text-primary/70 font-bold tracking-wider mb-0.5 uppercase">Size</span>
                                <span className="text-gray-200 font-medium text-sm truncate">{client.sqft}</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-auto pt-1 flex items-center justify-between">
                            {stats.daysSinceNum >= 0 ? (
                                <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap", daysSinceColor)}>
                                    {stats.daysSince}
                                </span>
                            ) : (
                                <span className="text-xs px-2.5 py-1 rounded-full font-medium text-muted-foreground bg-white/5">
                                    Never
                                </span>
                            )}

                            {isActiveMowing ? (
                                <Button
                                    onClick={onCompleteMowing}
                                    className="bg-white hover:bg-white/90 text-black font-bold shadow-[0_4px_15px_rgba(255,255,255,0.2)] transition-all active:scale-[0.97]"
                                >
                                    Complete Mowing
                                </Button>
                            ) : (
                                <Button
                                    onClick={onStartMowing}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_4px_15px_rgba(170,255,0,0.2)] transition-all active:scale-[0.97]"
                                >
                                    <Timer className="w-4 h-4 mr-2" />
                                    Start Mowing
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* ═══ Panel 1: Stats ═══ */}
                    <div className="swipe-panel p-4 pt-2">
                        <div className="flex items-center gap-2 mb-3">
                            <BarChart3 className="w-4 h-4 text-primary" />
                            <h4 className="text-sm font-bold text-white">Session Stats</h4>
                            <span className="text-[10px] text-muted-foreground ml-auto">{client.name}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {/* Visits */}
                            <div className="bg-[#151a17] rounded-xl p-3 border border-white/5 flex flex-col">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Hash className="w-3 h-3 text-primary/60" />
                                    <span className="text-[10px] text-primary/70 font-bold tracking-wider uppercase">Visits</span>
                                </div>
                                <span className="text-xl font-bold text-white">{stats.totalVisits}</span>
                            </div>

                            {/* Total Time */}
                            <div className="bg-[#151a17] rounded-xl p-3 border border-white/5 flex flex-col">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Clock className="w-3 h-3 text-primary/60" />
                                    <span className="text-[10px] text-primary/70 font-bold tracking-wider uppercase">Total Time</span>
                                </div>
                                <span className="text-base font-bold text-white">{stats.totalTimeStr}</span>
                            </div>

                            {/* Avg Time */}
                            <div className="bg-[#151a17] rounded-xl p-3 border border-white/5 flex flex-col">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Timer className="w-3 h-3 text-blue-400/60" />
                                    <span className="text-[10px] text-blue-400/70 font-bold tracking-wider uppercase">Avg Time</span>
                                </div>
                                <span className="text-base font-bold text-blue-300">{stats.avgTime}</span>
                            </div>

                            {/* Days Since */}
                            <div className="bg-[#151a17] rounded-xl p-3 border border-white/5 flex flex-col">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Calendar className="w-3 h-3 text-amber-400/60" />
                                    <span className="text-[10px] text-amber-400/70 font-bold tracking-wider uppercase">Last Visit</span>
                                </div>
                                <span className={cn("text-base font-bold", stats.daysSinceNum > 10 ? "text-rose-400" : stats.daysSinceNum > 5 ? "text-amber-400" : "text-white")}>
                                    {stats.daysSince}
                                </span>
                            </div>

                            {/* Stuck Time */}
                            <div className="bg-[#151a17] rounded-xl p-3 border border-white/5 flex flex-col">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Zap className="w-3 h-3 text-rose-400/60" />
                                    <span className="text-[10px] text-rose-400/70 font-bold tracking-wider uppercase">Stuck Time</span>
                                </div>
                                <span className="text-base font-bold text-rose-400">{stats.totalStuckStr}</span>
                            </div>

                            {/* Pause Time */}
                            <div className="bg-[#151a17] rounded-xl p-3 border border-white/5 flex flex-col">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <PauseCircle className="w-3 h-3 text-gray-400/60" />
                                    <span className="text-[10px] text-gray-400/70 font-bold tracking-wider uppercase">Pause Time</span>
                                </div>
                                <span className="text-base font-bold text-gray-400">{stats.totalBreakStr}</span>
                            </div>
                        </div>

                        {/* Revenue / Profit Summary */}
                        {showProfit && (
                            <div className="mt-3 flex gap-2">
                                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center">
                                    <span className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wider block mb-0.5">Revenue</span>
                                    <span className="text-base font-bold text-emerald-400">${profit.revenue.toFixed(0)}</span>
                                </div>
                                <div className={cn(
                                    "flex-1 border rounded-xl p-2.5 text-center",
                                    isPositive ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
                                )}>
                                    <span className={cn("text-[10px] font-bold uppercase tracking-wider block mb-0.5", isPositive ? "text-emerald-400/70" : "text-red-400/70")}>Profit</span>
                                    <span className={cn("text-base font-bold", isPositive ? "text-emerald-400" : "text-red-400")}>{fmtMoney(profit.profit)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ═══ Panel 2: Route ═══ */}
                    <div className="swipe-panel p-4 pt-2">
                        <div className="flex items-center gap-2 mb-3">
                            <Route className="w-4 h-4 text-primary" />
                            <h4 className="text-sm font-bold text-white">Saved Route</h4>
                            <span className="text-[10px] text-muted-foreground ml-auto">{client.name}</span>
                        </div>

                        {client.routeScreenshot && client.routeScreenshot.startsWith("data:image") ? (
                            <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.02]">
                                <img
                                    src={client.routeScreenshot}
                                    alt={`Route for ${client.name}`}
                                    className="w-full h-auto object-contain"
                                />
                            </div>
                        ) : client.lat && client.lng ? (
                            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 flex flex-col items-center justify-center text-center min-h-[160px]">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                                    <Route className="w-6 h-6 text-primary/50" />
                                </div>
                                <p className="text-sm text-muted-foreground mb-1">No saved route screenshot</p>
                                <p className="text-[10px] text-muted-foreground/60">Visit the Route Planner to create and save a route</p>
                                <p className="text-[10px] text-primary/50 mt-2">
                                    📍 {client.lat.toFixed(4)}, {client.lng.toFixed(4)}
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 flex flex-col items-center justify-center text-center min-h-[160px]">
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                                    <MapPin className="w-6 h-6 text-muted-foreground/30" />
                                </div>
                                <p className="text-sm text-muted-foreground mb-1">No location data</p>
                                <p className="text-[10px] text-muted-foreground/60">Add coordinates to this client to enable route planning</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Swipe dot indicators */}
            <SwipeDots count={panelCount} active={activePanel} />
        </div>
    );
}
