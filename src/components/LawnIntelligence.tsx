"use client";

import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle, XCircle, CloudRain, Wind, Thermometer, Calendar, TrendingUp } from "lucide-react";
import type { MowSafetyResult, BestDayResult, DayScore } from "@/lib/lawn-intelligence";

// ── Mow Safety Banner ──────────────────────────────────────────────────────────

interface MowSafetyBannerProps {
    safety: MowSafetyResult;
}

const safetyConfig = {
    yes: {
        icon: CheckCircle,
        bg: "bg-emerald-950/40",
        border: "border-emerald-500/30",
        iconColor: "text-emerald-400",
        headlineColor: "text-emerald-400",
        glow: "shadow-[0_0_20px_rgba(16,185,129,0.08)]",
        pulse: false,
    },
    caution: {
        icon: AlertTriangle,
        bg: "bg-amber-950/30",
        border: "border-amber-500/25",
        iconColor: "text-amber-400",
        headlineColor: "text-amber-400",
        glow: "shadow-[0_0_20px_rgba(245,158,11,0.08)]",
        pulse: true,
    },
    no: {
        icon: XCircle,
        bg: "bg-red-950/30",
        border: "border-red-500/25",
        iconColor: "text-red-400",
        headlineColor: "text-red-400",
        glow: "shadow-[0_0_20px_rgba(239,68,68,0.08)]",
        pulse: true,
    },
};

// Map keywords in reasons to icons
function getReasonIcon(reason: string) {
    const lower = reason.toLowerCase();
    if (lower.includes('rain') || lower.includes('wet')) return CloudRain;
    if (lower.includes('wind')) return Wind;
    if (lower.includes('°c') || lower.includes('heat') || lower.includes('cold') || lower.includes('dormant')) return Thermometer;
    return null;
}

export function MowSafetyBanner({ safety }: MowSafetyBannerProps) {
    const config = safetyConfig[safety.level];
    const Icon = config.icon;

    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-2xl border p-5 transition-all duration-300",
                config.bg,
                config.border,
                config.glow,
            )}
        >
            {/* Decorative background icon */}
            <Icon
                className={cn(
                    "absolute -right-6 -bottom-6 w-36 h-36 opacity-[0.03]",
                    config.iconColor,
                )}
            />

            <div className="flex items-start gap-4 relative z-10">
                <div
                    className={cn(
                        "flex items-center justify-center shrink-0 w-14 h-14 rounded-xl",
                        safety.level === 'yes' ? "bg-emerald-500/10" :
                            safety.level === 'caution' ? "bg-amber-500/10" :
                                "bg-red-500/10",
                    )}
                >
                    <Icon className={cn("w-7 h-7", config.iconColor, config.pulse && "animate-pulse")} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className={cn("text-xs font-bold uppercase tracking-widest", config.iconColor)}>
                            {safety.level === 'yes' ? '✓ SAFE TO MOW' : safety.level === 'caution' ? '⚠ CAUTION' : '✕ NOT TODAY'}
                        </span>
                    </div>

                    <h3 className={cn("text-lg font-black tracking-tight mb-2", config.headlineColor)}>
                        {safety.headline}
                    </h3>

                    <div className="space-y-1.5">
                        {safety.reasons.map((reason, i) => {
                            const ReasonIcon = getReasonIcon(reason);
                            return (
                                <div key={i} className="flex items-start gap-2">
                                    {ReasonIcon && (
                                        <ReasonIcon className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />
                                    )}
                                    <p className="text-sm text-muted-foreground/80 leading-snug">
                                        {reason}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {safety.advice && (
                        <p className="text-xs text-muted-foreground/50 mt-2 italic">
                            {safety.advice}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Best Day to Mow Banner ─────────────────────────────────────────────────────

interface BestDayBannerProps {
    bestDays: BestDayResult;
}

function ScoreBar({ day }: { day: DayScore }) {
    const getBarColor = (score: number) => {
        if (score >= 70) return "bg-emerald-500";
        if (score >= 50) return "bg-amber-500";
        if (score >= 30) return "bg-orange-500";
        return "bg-red-500";
    };

    return (
        <div className="flex items-center gap-2 group">
            <span className={cn(
                "text-xs font-bold w-14 text-right shrink-0 transition-colors",
                day.isToday ? "text-primary" : "text-muted-foreground/70",
            )}>
                {day.dayLabel}
            </span>
            <div className="flex-1 h-3 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                    className={cn(
                        "h-full rounded-full transition-all duration-700 ease-out",
                        getBarColor(day.score),
                        day.isToday && "opacity-100",
                        !day.isToday && "opacity-70 group-hover:opacity-100",
                    )}
                    style={{ width: `${day.score}%` }}
                />
            </div>
            <span className={cn(
                "text-xs font-mono w-8 shrink-0 transition-colors",
                day.score >= 70 ? "text-emerald-400" :
                    day.score >= 50 ? "text-amber-400" :
                        "text-muted-foreground/50",
            )}>
                {day.score}
            </span>
        </div>
    );
}

export function BestDayBanner({ bestDays }: BestDayBannerProps) {
    const topScore = Math.max(...bestDays.scores.map(d => d.score));
    const hasGoodDay = topScore >= 70;

    return (
        <div className={cn(
            "relative overflow-hidden rounded-2xl border p-5 transition-all duration-300",
            hasGoodDay
                ? "bg-emerald-950/20 border-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.05)]"
                : "bg-[#151a17] border-white/5",
        )}>
            {/* Decorative background */}
            <Calendar className="absolute -right-4 -bottom-4 w-28 h-28 opacity-[0.03] text-primary" />

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className={cn(
                        "w-5 h-5",
                        hasGoodDay ? "text-emerald-400" : "text-muted-foreground/50",
                    )} />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                        Best Day to Mow
                    </h3>
                </div>

                <p className={cn(
                    "text-base font-bold mb-4",
                    hasGoodDay ? "text-emerald-400" : "text-muted-foreground",
                )}>
                    {bestDays.recommendation}
                </p>

                <div className="space-y-2">
                    {bestDays.scores.slice(0, 5).map((day) => (
                        <ScoreBar key={day.date} day={day} />
                    ))}
                </div>
            </div>
        </div>
    );
}
