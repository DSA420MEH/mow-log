"use client";

import { useState, useRef, useCallback } from "react";
import { MapPin, Pencil, Timer, Route, TrendingUp, TrendingDown, BarChart3, Clock, Zap, PauseCircle, Calendar, Hash, AlertTriangle, DollarSign, Phone, ArrowLeft, XCircle, LucideIcon, CheckCircle2, Leaf, Mail, Ruler, FileText } from "lucide-react";
import type { CutHeightRecommendation } from "@/lib/cut-height-calc";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGrowthEstimate } from "@/hooks/use-lawn-intelligence";
import { checkOneThirdRule } from "@/lib/lawn-intelligence";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ClientData {
    id: string;
    name: string;
    address: string;
    phone?: string;
    email?: string;
    contractLength?: string;
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
    avatarStyle: { bg: string; text: string; borderTop?: string; borderLeft?: string; shadow?: string };
    cutHeight?: CutHeightRecommendation | null;
    onStartMowing: () => void;
    onCompleteMowing: () => void;
    onEdit?: () => void;
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
        <div className="flex items-center justify-center gap-2 pb-3 pt-1">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        "rounded-full transition-all duration-500",
                        i === active
                            ? "w-8 h-1.5 bg-primary shadow-[0_0_12px_rgba(170,255,0,0.6)] active-dot"
                            : "w-1.5 h-1.5 bg-white/10"
                    )}
                />
            ))}
        </div>
    );
}

// ── Metric Card ────────────────────────────────────────────────────────────────
function Metric({ label, value, subtext, icon: Icon, colorClass = "text-[#A3FF00]" }: { label: string; value: string | number; subtext?: string; icon: LucideIcon; colorClass?: string }) {
    return (
        <div className="bg-[#1f2420] rounded-2xl p-3.5 border border-white/5 flex flex-col justify-center shadow-lg">
            <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={cn("w-3.5 h-3.5", colorClass)} />
                <span className={cn("text-[10px] font-black tracking-widest uppercase opacity-80", colorClass)}>{label}</span>
            </div>
            <span className="text-xl font-black text-white leading-none">{value}</span>
            {subtext && <span className="text-[10px] text-white/40 mt-1">{subtext}</span>}
        </div>
    );
}

// ── Panel Labels ───────────────────────────────────────────────────────────────
const PANEL_LABELS = ["Stats", "Info", "Route"];

// ── Main Component ─────────────────────────────────────────────────────────────
export function SwipeableClientCard({
    client,
    stats,
    profit,
    isActiveMowing,
    activeSession,
    avatarStyle,
    cutHeight,
    onStartMowing,
    onCompleteMowing,
    onEdit,
    InlineMowTimer,
}: SwipeableClientCardProps) {
    const [activePanel, setActivePanel] = useState(0);
    const [showCutExplanation] = useState(false);
    const [showChecklist, setShowChecklist] = useState(false);
    const [showRecap, setShowRecap] = useState(false);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const isSwiping = useRef(false);

    const panelCount = 3;

    // -- Lawn Intelligence --
    const growth = useGrowthEstimate(client.id);
    const oneThirdRule = growth && cutHeight
        ? checkOneThirdRule(growth.estimatedGrowthInches, cutHeight.recommendedHeightIn)
        : null;

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

    let daysSinceColor = "text-[#A3FF00] border-[#A3FF00]/30 bg-[#A3FF00]/10";
    if (stats.daysSinceNum > 10) daysSinceColor = "text-rose-400 border-rose-500/30 bg-rose-500/10";
    else if (stats.daysSinceNum > 5) daysSinceColor = "text-amber-400 border-amber-500/30 bg-amber-500/10";

    const isPositive = profit.profit >= 0;
    const fmtMoney = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(0);
    const showProfit = profit.revenue !== 0 || profit.profit !== 0;

    return (
        <div
            className={cn(
                "glass-card glass-card-hover animate-card-in rounded-2xl bg-[#1a201c] border-x border-b border-t-2 relative overflow-hidden flex flex-col transition-all duration-300",
                avatarStyle.borderTop || "border-t-white/10",
                isActiveMowing
                    ? "border-primary shadow-[0_0_20px_rgba(195,255,0,0.12)] border-t-primary"
                    : "border-white/5 hover:border-white/20"
            )}
        >
            {/* Active mowing indicator */}
            {isActiveMowing && (
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent z-20 shadow-[0_0_12px_4px_rgba(195,255,0,0.25)]"></div>
            )}

            {/* Panel label tab */}
            <div className="flex items-center justify-between px-4 pt-4 pb-1 z-30">
                <div className="relative flex items-center p-1 bg-black/20 rounded-lg backdrop-blur-md border border-white/[0.07]">
                    {/* Sliding pill */}
                    <span
                        className="absolute top-0.5 bottom-0.5 rounded-md bg-primary/20 border border-primary/20 shadow-[0_0_12px_rgba(170,255,0,0.15),inset_0_0_8px_rgba(195,255,0,0.08)] transition-all duration-300 ease-out pointer-events-none"
                        style={{
                            left: `calc(${activePanel} * (100% - 0.5rem) / ${PANEL_LABELS.length} + 0.25rem)`,
                            width: `calc((100% - 0.5rem) / ${PANEL_LABELS.length})`,
                        }}
                    />
                    {PANEL_LABELS.map((label, i) => (
                        <button
                            key={label}
                            onClick={() => setActivePanel(i)}
                            className={cn(
                                "relative z-10 text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-md transition-colors duration-200 min-w-[52px]",
                                i === activePanel
                                    ? "text-primary"
                                    : "text-white/30 hover:text-white/60"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={onEdit}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-all"
                >
                    <Pencil className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Persistent Client Header */}
            <div className="px-4 pt-4 pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex gap-3 items-start">
                        <div className={cn(
                            "w-14 h-14 rounded-[16px] flex items-center justify-center font-black text-xl transition-all duration-300 hover:scale-105",
                            avatarStyle.bg, avatarStyle.text, avatarStyle.shadow,
                            isActiveMowing && "ring-2 ring-[#A3FF00]/60 ring-offset-2 ring-offset-[#1a201c] shadow-[0_0_15px_rgba(163,255,0,0.4)]"
                        )}>
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

                {/* Profit & Rate Badge */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                    {showProfit && (
                        <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black tracking-tight",
                            isPositive ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-red-500/15 text-red-400 border border-red-500/20"
                        )}>
                            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {fmtMoney(profit.profit)}
                        </div>
                    )}

                    {client.amount > 0 ? (
                        <span className="text-[11px] font-bold text-white/40 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                            {client.billingType === "Regular" ? `$${client.amount}/mo` : `$${client.amount}/cut`}
                        </span>
                    ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                            <AlertTriangle className="w-3 h-3" />
                            RATE MISSING
                        </div>
                    )}

                    {/* Growth Estimate Badge */}
                    {growth && (
                        <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black tracking-tight border",
                            growth.urgent
                                ? "bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(243,24,96,0.15)] animate-pulse"
                                : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                        )}>
                            <Leaf className="w-3.5 h-3.5" />
                            {growth.estimatedGrowthInches > 0
                                ? `+${growth.estimatedGrowthInches.toFixed(1)}"`
                                : `No Growth`}
                        </div>
                    )}
                </div>

                {/* One-Third Rule Warning */}
                {oneThirdRule?.violated && (
                    <div className="mt-2 mx-0 px-3 py-2 rounded-lg text-[10.5px] font-medium leading-tight bg-rose-500/10 border border-rose-500/20 text-rose-200">
                        <div className="flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <span>
                                <strong className="font-bold text-rose-300">1/3 Rule:</strong> {oneThirdRule.message}
                            </span>
                        </div>
                    </div>
                )}

                {/* Cut Height Explanation (expandable) */}
                {cutHeight && showCutExplanation && (
                    <div className={cn(
                        "mt-1 mx-0 px-3 py-2 rounded-lg text-[10px] leading-relaxed border animate-in fade-in slide-in-from-top-1 duration-200",
                        cutHeight.level === 'high'
                            ? "bg-amber-500/5 border-amber-500/10 text-amber-300/80"
                            : cutHeight.level === 'low'
                                ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-300/80"
                                : "bg-white/[0.02] border-white/5 text-white/40"
                    )}>
                        <span className="font-bold">{cutHeight.label}</span> — {cutHeight.explanation}
                    </div>
                )}

                {/* Active Mowing Timer */}
                {isActiveMowing && activeSession && (
                    <div className="mt-3 py-2 border-y border-primary/20 flex items-center justify-center gap-2">
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
            </div>

            {/* Swipeable panels container */}
            <div
                className="flex-1 relative overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    className="flex transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(-${activePanel * 100}%)` }}
                >
                    {/* ═══ Panel 0: Stats (Default) ═══ */}
                    <div className="w-full shrink-0 min-w-full p-4 pt-4 flex flex-col justify-between">
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <Metric label="Visits" value={stats.totalVisits} icon={Hash} colorClass="text-[#A3FF00]" />
                            <Metric label="Total Time" value={stats.totalTimeStr} icon={Clock} colorClass="text-blue-400" />
                            <Metric label="Avg / Visit" value={stats.avgTime} icon={Zap} colorClass="text-purple-400" />
                            <Metric label="Last Visit" value={`${stats.daysSinceNum}d`} subtext="days ago" icon={Calendar} colorClass="text-rose-400" />
                            <Metric label="Stuck" value={stats.totalStuckStr} icon={Zap} colorClass="text-rose-400" />
                            <Metric label="Paused" value={stats.totalBreakStr} icon={PauseCircle} colorClass="text-gray-400" />
                        </div>

                        {showProfit && (
                            <div className="flex border border-white/5 rounded-2xl bg-white/[0.02] mb-6 shadow-lg">
                                <div className="flex-1 p-4 text-center border-r border-white/5">
                                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Earned</div>
                                    <div className="text-2xl font-black text-white">${profit.revenue.toFixed(0)}</div>
                                    <div className="text-[10px] text-white/40 mt-1">Season: ${client.amount > 0 ? (client.amount * 7) : 840}</div>
                                </div>
                                <div className="flex-1 p-4 text-center">
                                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Net Profit</div>
                                    <div className={cn("text-2xl font-black", isPositive ? "text-emerald-400" : "text-rose-500")}>{fmtMoney(profit.profit)}</div>
                                    <div className="text-[10px] text-white/40 mt-1">after expenses</div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pb-1">
                            {stats.daysSinceNum >= 0 ? (
                                <span className={cn("text-xs px-3.5 py-1.5 rounded-full font-bold border", daysSinceColor)}>
                                    {stats.daysSince}
                                </span>
                            ) : (
                                <span className="text-xs px-3.5 py-1.5 rounded-full font-bold text-muted-foreground border border-white/10 bg-white/5">
                                    Never
                                </span>
                            )}

                            {isActiveMowing ? (
                                showRecap ? (
                                    <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-4">
                                        <Button onClick={() => setShowRecap(false)} variant="ghost" className="text-white hover:bg-white/10 rounded-xl px-4 h-11">
                                            Cancel
                                        </Button>
                                        <Button onClick={() => { setShowRecap(false); onCompleteMowing(); }} className="rounded-xl font-black bg-emerald-500 hover:bg-emerald-400 text-black px-6 h-11 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                                            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm
                                        </Button>
                                    </div>
                                ) : (
                                    <Button onClick={() => setShowRecap(true)} className="rounded-xl font-black bg-white hover:bg-white/90 text-black px-6 h-11 shadow-[0_4px_15px_rgba(255,255,255,0.2)] transition-all active:scale-[0.97]">
                                        Complete Mowing
                                    </Button>
                                )
                            ) : (
                                showChecklist ? (
                                    <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-4">
                                        <Button onClick={() => setShowChecklist(false)} variant="ghost" className="text-white hover:bg-white/10 rounded-xl px-4 h-11">
                                            Cancel
                                        </Button>
                                        <Button onClick={() => { setShowChecklist(false); onStartMowing(); }} className="rounded-xl font-black bg-[#A3FF00] hover:bg-[#A3FF00]/90 text-black px-6 h-11 shadow-[0_0_20px_rgba(163,255,0,0.2)]">
                                            <Timer className="w-4 h-4 mr-1.5" /> Start
                                        </Button>
                                    </div>
                                ) : (
                                    <Button onClick={() => setShowChecklist(true)} className="rounded-xl font-black bg-[#A3FF00] hover:bg-[#A3FF00]/90 text-black px-6 h-11 shadow-[0_0_20px_rgba(163,255,0,0.2)]">
                                        <Timer className="w-4 h-4 mr-2" /> Start Mow
                                    </Button>
                                )
                            )}
                        </div>
                    </div>

                    {/* ═══ Panel 1: Info ═══ */}
                    <div className="w-full shrink-0 min-w-full px-4 pb-2">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-4 py-4 border-b border-white/5">
                                <div className="w-12 h-12 rounded-2xl bg-[#A3FF00]/10 flex items-center justify-center shrink-0 border border-[#A3FF00]/20">
                                    <Phone className="w-5 h-5 text-[#A3FF00]" />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Phone</span>
                                    <span className="text-base font-bold text-white tracking-tight truncate">{client.phone || "—"}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 py-4 border-b border-white/5">
                                <div className="w-12 h-12 rounded-2xl bg-[#A3FF00]/10 flex items-center justify-center shrink-0 border border-[#A3FF00]/20">
                                    <Mail className="w-5 h-5 text-[#A3FF00]" />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Email</span>
                                    <span className="text-base font-bold text-white tracking-tight truncate">{client.email || "—"}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 py-4 border-b border-white/5">
                                <div className="w-12 h-12 rounded-2xl bg-[#A3FF00]/10 flex items-center justify-center shrink-0 border border-[#A3FF00]/20">
                                    <Ruler className="w-5 h-5 text-[#A3FF00]" />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Lot Size</span>
                                    <span className="text-base font-bold text-white tracking-tight truncate">{client.sqft || "—"}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 py-4 border-b border-white/5">
                                <div className="w-12 h-12 rounded-2xl bg-[#A3FF00]/10 flex items-center justify-center shrink-0 border border-[#A3FF00]/20">
                                    <FileText className="w-5 h-5 text-[#A3FF00]" />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Contract</span>
                                    <span className="text-base font-bold text-white tracking-tight truncate">{client.contractLength || "—"}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 py-4">
                                <div className="w-12 h-12 rounded-2xl bg-[#A3FF00]/10 flex items-center justify-center shrink-0 border border-[#A3FF00]/20">
                                    <DollarSign className="w-5 h-5 text-[#A3FF00]" />
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Billing</span>
                                    <span className="text-base font-bold text-white tracking-tight truncate">
                                        {client.billingType === "Regular" ? `$${client.amount}/month` : `$${client.amount}/cut`}
                                        {client.amount > 0 && ` - $${client.amount * 7} season`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ Panel 2: Route ═══ */}
                    <div className="w-full shrink-0 min-w-full p-4 pt-2">
                        <div className="flex items-center gap-2 mb-4">
                            <Route className="w-4 h-4 text-[#A3FF00]" />
                            <h4 className="text-xs font-black text-white uppercase tracking-widest">Saved Route</h4>
                        </div>

                        {client.routeScreenshot && client.routeScreenshot.startsWith("data:image") ? (
                            <div className="space-y-4">
                                <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] shadow-2xl">
                                    <Image
                                        src={client.routeScreenshot}
                                        alt={`Route for ${client.name}`}
                                        width={1200}
                                        height={800}
                                        unoptimized
                                        className="w-full h-auto object-contain"
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setActivePanel(0)}
                                    className="w-full h-10 border-white/10 bg-white/5 text-xs font-bold text-white hover:bg-white/10 flex items-center justify-center gap-2 group"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                                    Exit Route View
                                </Button>
                            </div>
                        ) : (
                            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black group min-h-[220px]">
                                <Image
                                    src="/lawn-placeholder.png"
                                    alt="Lawn View"
                                    fill
                                    sizes="(max-width: 768px) 100vw, 420px"
                                    className="absolute inset-0 object-cover opacity-40 group-hover:scale-110 transition-transform duration-1000"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#1a201c] via-[#1a201c]/40 to-transparent" />

                                <div className="absolute bottom-4 left-4 right-4 flex flex-col">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center backdrop-blur-md">
                                            <Route className="w-4 h-4 text-primary" />
                                        </div>
                                        <span className="text-xs font-bold text-white tracking-wide">Target Route Overlay</span>
                                    </div>
                                    <p className="text-[10px] text-gray-300 leading-relaxed mb-3">
                                        No active route overlay detected. Synchronize with satellite mapping to view property boundaries.
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                        className="w-fit text-[10px] h-7 border-primary/30 text-primary hover:bg-primary/10"
                                    >
                                        <Link href={`/route-planner?initClient=${client.id}`}>
                                            Initialize Route Map
                                        </Link>
                                    </Button>
                                </div>
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button
                                        onClick={() => setActivePanel(0)}
                                        className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                                        title="Exit Panel"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                </div>

                                {client.lat && client.lng && (
                                    <div className="absolute top-4 left-4 px-2 py-1 rounded bg-black/60 backdrop-blur-md border border-white/5 text-[9px] font-mono text-white/70">
                                        {client.lat.toFixed(4)}, {client.lng.toFixed(4)}
                                    </div>
                                )}
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
