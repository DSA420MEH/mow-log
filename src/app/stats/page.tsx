"use client";

import { useStore, type Client, type Session } from "@/lib/store";
import { computeClientProfit } from "@/lib/selectors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Timer, Fuel, Wrench, Briefcase,
    Users, Clock, AlertTriangle, Zap, DollarSign, BarChart3
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { useState, useEffect, useMemo } from "react";
import { useCountUp } from "@/hooks/use-count-up";

// ── Helpers ──────────────────────────────────────
const fmtHrs = (sec: number) => {
    if (sec < 3600) return Math.round(sec / 60) + "m";
    return (sec / 3600).toFixed(1) + "h";
};
const fmtMoney = (n: number) => "$" + n.toFixed(2);
const pct = (part: number, total: number) =>
    total === 0 ? "0%" : Math.round((part / total) * 100) + "%";



// ── Per-client stats helper ──────────────────────
function computeClientStats(client: Client, sessions: Session[]) {
    const mows = sessions.filter(
        s => s.type === "address-mow" && s.clientId === client.id && s.status === "completed" && s.endTime
    );
    const totalMowSec = mows.reduce((acc, s) => {
        const dur = (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) / 1000;
        return acc + dur - s.breakTimeTotal - (s.stuckTimeTotal || 0);
    }, 0);
    const totalStuckSec = mows.reduce((acc, s) => acc + (s.stuckTimeTotal || 0), 0);
    const totalBreakSec = mows.reduce((acc, s) => acc + s.breakTimeTotal, 0);
    const avgMowSec = mows.length > 0 ? totalMowSec / mows.length : 0;
    const revenue =
        client.billingType === "Regular" ? client.amount : client.amount * mows.length;
    const hourlyRate = totalMowSec > 0 ? revenue / (totalMowSec / 3600) : 0;

    return {
        visits: mows.length,
        totalMowSec,
        avgMowSec,
        totalStuckSec,
        totalBreakSec,
        revenue,
        hourlyRate,
    };
}

// ── Stat Pill component ─────────────────────────
function StatPill({ label, value, icon: Icon, accent = false, sub }: {
    label: string; value: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    accent?: boolean; sub?: string;
}) {
    return (
        <div className={`rounded-xl p-4 border ${accent
            ? "border-primary/40 bg-primary/5 shadow-[0_0_15px_rgba(170,255,0,0.05)]"
            : "border-white/10 bg-white/[0.03]"
            }`}>
            <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-4 h-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">{label}</span>
            </div>
            <p className={`text-xl font-bold ${accent ? "text-primary drop-shadow-[0_0_8px_rgba(170,255,0,0.5)]" : "text-foreground"}`}>{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
    );
}

// ── Animated Number Component ─────────────────────
function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0, className = "" }: { value: number; prefix?: string; suffix?: string; decimals?: number; className?: string }) {
    const { count, ref } = useCountUp(value, 1500);
    return (
        <span ref={ref} className={className}>
            {prefix}{count.toFixed(decimals)}{suffix}
        </span>
    );
}

// ── Sparkline component ─────────────────────────
function Sparkline({ data, color = "#aaff00" }: { data: { v: number }[]; color?: string }) {
    if (data.length < 2) return null;
    return (
        <div className="h-[40px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
                        fill={`url(#spark-${color.replace('#', '')})`} dot={false} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// ── Client Row component ────────────────────────
function ClientRow({ client, stats, rank }: {
    client: Client; stats: ReturnType<typeof computeClientStats> & { profit: number }; rank: number
}) {
    const isPositive = stats.profit >= 0;
    return (
        <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{rank}</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{client.name}</p>
                <p className="text-[11px] text-muted-foreground">
                    {stats.visits} visits · avg {fmtHrs(stats.avgMowSec)}/visit
                </p>
            </div>
            <div className="text-right flex-shrink-0">
                <p className="font-bold text-sm text-primary">{fmtMoney(stats.revenue)}</p>
                <p className={`text-[11px] font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPositive ? '+' : ''}{fmtMoney(stats.profit)} profit
                </p>
            </div>
        </div>
    );
}

// ── Main Page ───────────────────────────────────
export default function StatsPage() {
    const { clients, sessions, gasLogs, maintenanceLogs } = useStore();
    const [isMounted, setIsMounted] = useState(false);
    const [dateFilter, setDateFilter] = useState<'30d' | 'thisYear' | 'allTime'>('allTime');
    const [revenueSplit, setRevenueSplit] = useState<'All' | 'Regular' | 'PerCut'>('All');

    useEffect(() => { setIsMounted(true); }, []);

    // ── Aggregate Computations ──
    const stats = useMemo(() => {
        // eslint-disable-next-line react-hooks/purity
        const nowMs = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const startOfYearMs = new Date(new Date().getFullYear(), 0, 1).getTime();

        const timeFilter = (timeMs: number) => {
            if (dateFilter === 'allTime') return true;
            if (dateFilter === '30d') return nowMs - timeMs <= thirtyDaysMs;
            if (dateFilter === 'thisYear') return timeMs >= startOfYearMs;
            return true;
        };

        const completedMows = sessions.filter(
            s => s.type === "address-mow" && s.status === "completed" && s.endTime && timeFilter(new Date(s.endTime).getTime())
        );
        const completedWorkdays = sessions.filter(
            s => s.type === "workday" && s.status === "completed" && s.endTime && timeFilter(new Date(s.endTime).getTime())
        );

        const totalWorkSec = completedWorkdays.reduce((acc, s) => {
            return acc + (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) / 1000;
        }, 0);

        const totalBreakSec = completedWorkdays.reduce((a, s) => a + s.breakTimeTotal, 0);
        const netWorkSec = totalWorkSec - totalBreakSec;

        const totalMowSec = completedMows.reduce((acc, s) => {
            return acc + (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) / 1000 - s.breakTimeTotal - (s.stuckTimeTotal || 0);
        }, 0);

        const totalStuckSec = completedMows.reduce((a, s) => a + (s.stuckTimeTotal || 0), 0);
        const totalMowBreakSec = completedMows.reduce((a, s) => a + s.breakTimeTotal, 0);

        // Financial
        const totalGas = gasLogs.reduce((a, l) => a + l.total, 0);
        const totalMaint = maintenanceLogs.reduce((a, l) => a + l.totalCost, 0);
        const totalExpenses = totalGas + totalMaint;

        let totalIncome = 0;
        clients.forEach(c => {
            if (c.billingType === "Regular") {
                totalIncome += c.amount;
            } else {
                totalIncome += c.amount * completedMows.filter(s => s.clientId === c.id).length;
            }
        });
        const netIncome = totalIncome - totalExpenses;
        const profitMargin = totalIncome > 0 ? (netIncome / totalIncome) * 100 : 0;
        const effectiveHourlyRate = totalMowSec > 0 ? totalIncome / (totalMowSec / 3600) : 0;

        // Efficiency
        const efficiency = totalWorkSec > 0 ? (totalMowSec / totalWorkSec) * 100 : 0;

        // Session sparkline (last 10 mows by duration)
        const last10Mows = completedMows.slice(-10).map(s => ({
            v: (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) / 60000, // minutes
        }));

        // 8-week revenue trend
        const weeklyRev: Record<number, { label: string; revenue: number }> = {};
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        for (let i = 7; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
            const label = `${d.getMonth() + 1}/${d.getDate()}`;
            weeklyRev[7 - i] = { label, revenue: 0 };
        }

        completedMows.forEach(s => {
            const mowDate = new Date(s.startTime);
            const diffTime = now.getTime() - mowDate.getTime();
            if (diffTime >= 0) {
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                const weekIdx = 7 - Math.floor(diffDays / 7);
                if (weekIdx >= 0 && weekIdx <= 7) {
                    const client = clients.find(c => c.id === s.clientId);
                    if (client) {
                        if (revenueSplit === 'All' || client.billingType === revenueSplit) {
                            // Assign per-cut revenue, or roughly 1/4th of monthly regular billing for a single week's cut
                            const rev = client.billingType === "PerCut" ? client.amount : (client.amount / 4);
                            weeklyRev[weekIdx].revenue += rev;
                        }
                    }
                }
            }
        });
        const weeklyData = Object.values(weeklyRev);

        // Mow Frequency Breakdown
        const frequencyCounts: Record<string, number> = { "Weekly": 0, "Bi-Weekly": 0, "Monthly": 0, "Other": 0 };
        clients.forEach(c => {
            const freq = (c.contractLength || "Weekly").toLowerCase();
            if (freq.includes("bi")) frequencyCounts["Bi-Weekly"]++;
            else if (freq.includes("week")) frequencyCounts["Weekly"]++;
            else if (freq.includes("month")) frequencyCounts["Monthly"]++;
            else frequencyCounts["Other"]++;
        });
        const frequencyData = Object.entries(frequencyCounts)
            .filter(([, value]) => value > 0)
            .map(([name, value]) => ({ name, value }));

        // Per-client stats with profit
        const clientStats = clients.map(c => {
            const baseStats = computeClientStats(c, sessions);
            const profitData = computeClientProfit(c.id);
            return {
                client: c,
                stats: { ...baseStats, profit: profitData.profit },
            };
        }).sort((a, b) => b.stats.revenue - a.stats.revenue);

        // Gas sparkline
        const gasSparkline = gasLogs.slice(-10).map(g => ({ v: g.total }));

        // Expense breakdown for pie
        const expenseBreakdown = [
            { name: "Gas", value: totalGas > 0 ? totalGas : 0.01 },
            { name: "Maintenance", value: totalMaint > 0 ? totalMaint : 0.01 },
        ];

        return {
            completedMows, completedWorkdays,
            totalWorkSec, netWorkSec, totalBreakSec,
            totalMowSec, totalStuckSec, totalMowBreakSec,
            totalGas, totalMaint, totalExpenses,
            totalIncome, netIncome, profitMargin, effectiveHourlyRate,
            efficiency,
            last10Mows, weeklyData, frequencyData, clientStats, gasSparkline, expenseBreakdown,
        };
    }, [clients, sessions, gasLogs, maintenanceLogs, dateFilter, revenueSplit]);

    if (!isMounted) return null;

    const COLORS_EXP = ['#ff6b35', '#ff4444'];
    const COLORS_FREQ = ['#aaff00', '#22c55e', '#14b8a6', '#6366f1'];

    const avgRevPerMow = stats.completedMows.length > 0 ? stats.totalIncome / stats.completedMows.length : 0;

    return (
        <main className="p-4 pb-28 min-h-screen space-y-4">
            {/* HEADER */}
            <div className="pt-4 mb-2 flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-white">
                        <span className="text-primary">Business</span> Analytics
                    </h1>
                    <p className="text-muted-foreground text-xs">Season overview · {clients.length} clients · {stats.completedMows.length} sessions</p>
                </div>
                <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                    <button onClick={() => setDateFilter('30d')} className={`px-2 py-1 flex items-center gap-1.5 rounded-md text-[10px] font-bold transition-all ${dateFilter === '30d' ? 'bg-primary text-black shadow-md' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}>30D</button>
                    <button onClick={() => setDateFilter('thisYear')} className={`px-2 py-1 flex items-center gap-1.5 rounded-md text-[10px] font-bold transition-all ${dateFilter === 'thisYear' ? 'bg-primary text-black shadow-md' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}>YTD</button>
                    <button onClick={() => setDateFilter('allTime')} className={`px-2 py-1 flex items-center gap-1.5 rounded-md text-[10px] font-bold transition-all ${dateFilter === 'allTime' ? 'bg-primary text-black shadow-md' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}>ALL</button>
                </div>
            </div>

            {/* ── HERO KPI BANNER ── */}
            <div className="rounded-2xl bg-gradient-to-br from-[#1a201c] to-black border border-primary/20 shadow-[0_0_25px_rgba(195,255,0,0.1)] p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <DollarSign className="w-32 h-32" />
                </div>

                <p className="text-xs uppercase tracking-widest text-primary/70 font-semibold mb-1">Total Revenue</p>
                <h2 className="text-4xl font-black text-white drop-shadow-[0_0_15px_rgba(195,255,0,0.4)] mb-3">
                    <AnimatedNumber value={stats.totalIncome} prefix="$" decimals={2} />
                </h2>

                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 mt-0">Total Mows</p>
                        <p className="text-xl font-bold text-gray-200">
                            <AnimatedNumber value={stats.completedMows.length} />
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 mt-0">Avg / Mow</p>
                        <p className="text-xl font-bold text-emerald-400">
                            <AnimatedNumber value={avgRevPerMow} prefix="$" decimals={2} />
                        </p>
                    </div>
                </div>
            </div>

            {/* ── KPI GRID ── */}
            <div className="grid grid-cols-2 gap-2.5">
                <StatPill label="Mowing Time" value={fmtHrs(stats.totalMowSec)} icon={Timer} accent
                    sub={`${stats.completedMows.length} sessions`} />
                <StatPill label="Work Time" value={fmtHrs(stats.netWorkSec)} icon={Briefcase}
                    sub={`${stats.completedWorkdays.length} workdays`} />
                <StatPill label="Efficiency" value={stats.efficiency.toFixed(0) + "%"} icon={Zap} accent
                    sub="mow time / work time" />
                <StatPill label="Stuck Time" value={fmtHrs(stats.totalStuckSec)} icon={AlertTriangle}
                    sub={pct(stats.totalStuckSec, stats.totalMowSec) + " of mow time"} />
            </div>

            {/* ── SESSION SPARKLINE ── */}
            {stats.last10Mows.length >= 2 && (
                <Card className="border-white/10 bg-white/[0.02]">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Last 10 Sessions (min)</p>
                            <BarChart3 className="w-3.5 h-3.5 text-primary/50" />
                        </div>
                        <Sparkline data={stats.last10Mows} />
                    </CardContent>
                </Card>
            )}

            {/* ── CHARTS ROW ── */}
            <div className="grid grid-cols-1 gap-3">
                {/* 8-Week Revenue Bar Chart */}
                <Card className="border-white/10 bg-white/[0.02] overflow-hidden group">
                    <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between">
                        <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 group-hover:text-primary transition-colors" /> 8-Week Revenue
                        </CardTitle>
                        <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/5">
                            <button onClick={() => setRevenueSplit('All')} className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${revenueSplit === 'All' ? 'bg-white/20 text-white' : 'text-muted-foreground hover:text-white'}`}>All</button>
                            <button onClick={() => setRevenueSplit('Regular')} className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${revenueSplit === 'Regular' ? 'bg-white/20 text-white' : 'text-muted-foreground hover:text-white'}`}>Reg</button>
                            <button onClick={() => setRevenueSplit('PerCut')} className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${revenueSplit === 'PerCut' ? 'bg-white/20 text-white' : 'text-muted-foreground hover:text-white'}`}>PerCut</button>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.weeklyData} margin={{ top: 10, right: 0, bottom: 0, left: -20 }}>
                                    <XAxis dataKey="label" stroke="#6b8c6b" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#6b8c6b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(170,255,0,0.05)' }}
                                        contentStyle={{ backgroundColor: 'rgba(10, 15, 13, 0.95)', borderColor: 'rgba(170,255,0,0.3)', borderRadius: '12px', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
                                        itemStyle={{ color: '#aaff00', fontWeight: 'bold' }}
                                        formatter={(value: number | string | undefined) => [`$${Number(value || 0).toFixed(0)}`, 'Revenue']}
                                    />
                                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]} className="fill-primary drop-shadow-[0_0_8px_rgba(170,255,0,0.3)]">
                                        {stats.weeklyData.map((entry, i) => (
                                            <Cell key={i} fill={entry.revenue > 0 ? '#aaff00' : '#1a201c'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Mow Frequency Pie Chart */}
                <Card className="border-white/10 bg-white/[0.02]">
                    <CardHeader className="pb-1 pt-3 px-4">
                        <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Mow Frequency
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 flex items-center gap-4">
                        <div className="h-[140px] w-[140px] flex-shrink-0 relative">
                            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                <span className="text-2xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"><AnimatedNumber value={clients.length} /></span>
                                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Clients</span>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.frequencyData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                                        paddingAngle={5} dataKey="value" stroke="none">
                                        {stats.frequencyData.map((_, i) => (
                                            <Cell key={i} fill={COLORS_FREQ[i % COLORS_FREQ.length]} className="drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]" />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0a0f0d', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-3">
                            {stats.frequencyData.map((d, i) => (
                                <div key={d.name} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS_FREQ[i % COLORS_FREQ.length], boxShadow: `0 0 8px ${COLORS_FREQ[i % COLORS_FREQ.length]}80` }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-300 font-medium">{d.name}</p>
                                    </div>
                                    <p className="text-sm font-bold text-white"><AnimatedNumber value={d.value} /></p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── CLIENT LEADERBOARD ── */}
            {stats.clientStats.length > 0 && (
                <Card className="border-white/10 bg-white/[0.02]">
                    <CardHeader className="pb-1 pt-3 px-4">
                        <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" /> Client Leaderboard
                            <span className="ml-auto text-primary/60 font-normal">by revenue</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                        {stats.clientStats.map((cs, i) => (
                            <ClientRow key={cs.client.id} client={cs.client} stats={cs.stats} rank={i + 1} />
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* ── EXPENSE BREAKDOWN ── */}
            {stats.totalExpenses > 0 && (
                <Card className="border-white/10 bg-white/[0.02]">
                    <CardHeader className="pb-1 pt-3 px-4">
                        <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5" /> Expense Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 flex items-center gap-4">
                        <div className="h-[100px] w-[100px] flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.expenseBreakdown} cx="50%" cy="50%" innerRadius={30} outerRadius={45}
                                        paddingAngle={4} dataKey="value" stroke="none">
                                        {stats.expenseBreakdown.map((_, i) => (
                                            <Cell key={i} fill={COLORS_EXP[i]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-2.5">
                            <div className="flex items-center gap-2">
                                <Fuel className="w-3.5 h-3.5 text-orange-400" />
                                <div className="flex-1">
                                    <p className="text-[11px] text-muted-foreground">Gas / Fuel</p>
                                    <p className="text-sm font-bold text-orange-400">{fmtMoney(stats.totalGas)}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">{pct(stats.totalGas, stats.totalExpenses)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Wrench className="w-3.5 h-3.5 text-red-400" />
                                <div className="flex-1">
                                    <p className="text-[11px] text-muted-foreground">Maintenance</p>
                                    <p className="text-sm font-bold text-red-400">{fmtMoney(stats.totalMaint)}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">{pct(stats.totalMaint, stats.totalExpenses)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── QUICK STATS FOOTER ── */}
            <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] text-muted-foreground uppercase">Avg/Session</p>
                    <p className="text-sm font-bold text-foreground">
                        {stats.completedMows.length > 0 ? fmtHrs(stats.totalMowSec / stats.completedMows.length) : "–"}
                    </p>
                </div>
                <div className="text-center p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] text-muted-foreground uppercase">Gas Logs</p>
                    <p className="text-sm font-bold text-foreground">{gasLogs.length}</p>
                </div>
                <div className="text-center p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                    <p className="text-[10px] text-muted-foreground uppercase">Repairs</p>
                    <p className="text-sm font-bold text-foreground">{maintenanceLogs.length}</p>
                </div>
            </div>
        </main>
    );
}
