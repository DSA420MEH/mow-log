/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useStore, type Client, type Session } from "@/lib/store";
import { computeClientProfit } from "@/lib/selectors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Timer, Fuel, Wrench, Briefcase, TrendingUp, TrendingDown,
    Users, Clock, AlertTriangle, Zap, DollarSign, BarChart3
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { useState, useEffect, useMemo } from "react";

// ── Helpers ──────────────────────────────────────
const fmtHrs = (sec: number) => {
    if (sec < 3600) return Math.round(sec / 60) + "m";
    return (sec / 3600).toFixed(1) + "h";
};
const fmtMoney = (n: number) => "$" + n.toFixed(2);
const pct = (part: number, total: number) =>
    total === 0 ? "0%" : Math.round((part / total) * 100) + "%";

function getMonthLabel(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short" });
}

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
            ? "border-primary/40 bg-primary/5"
            : "border-white/10 bg-white/[0.03]"
            }`}>
            <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-4 h-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">{label}</span>
            </div>
            <p className={`text-xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
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

    useEffect(() => { setIsMounted(true); }, []);

    // ── Aggregate Computations ──
    const stats = useMemo(() => {
        const completedMows = sessions.filter(
            s => s.type === "address-mow" && s.status === "completed" && s.endTime
        );
        const completedWorkdays = sessions.filter(
            s => s.type === "workday" && s.status === "completed" && s.endTime
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

        // Monthly revenue trend
        const monthlyRev: Record<string, number> = {};
        completedMows.forEach(s => {
            const label = getMonthLabel(s.startTime);
            const client = clients.find(c => c.id === s.clientId);
            if (client) {
                const rev = client.billingType === "PerCut" ? client.amount : 0;
                monthlyRev[label] = (monthlyRev[label] || 0) + rev;
            }
        });
        // Add regular client income to first month or distribute
        clients.filter(c => c.billingType === "Regular").forEach(c => {
            const firstKey = Object.keys(monthlyRev)[0] || "Current";
            monthlyRev[firstKey] = (monthlyRev[firstKey] || 0) + c.amount;
        });
        const monthlyData = Object.entries(monthlyRev).map(([name, amount]) => ({ name, amount }));

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
            last10Mows, monthlyData, clientStats, gasSparkline, expenseBreakdown,
        };
    }, [clients, sessions, gasLogs, maintenanceLogs]);

    if (!isMounted) return null;

    const COLORS_EXP = ['#ff6b35', '#ff4444'];
    const COLORS_TIME = ['#aaff00', '#1a3a1a', '#ff6b35'];

    const timeData = [
        { name: "Active Mowing", value: stats.totalMowSec > 0 ? stats.totalMowSec : 1 },
        { name: "Breaks", value: stats.totalBreakSec > 0 ? stats.totalBreakSec : 1 },
        { name: "Stuck", value: stats.totalStuckSec > 0 ? stats.totalStuckSec : 1 },
    ];

    const incomeData = [
        { name: "Revenue", amount: stats.totalIncome },
        { name: "Expenses", amount: stats.totalExpenses },
        { name: "Profit", amount: Math.max(stats.netIncome, 0) },
    ];

    return (
        <main className="p-4 pb-28 min-h-screen space-y-4">
            {/* HEADER */}
            <div className="pt-4 mb-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-white">
                    <span className="text-primary">Business</span> Analytics
                </h1>
                <p className="text-muted-foreground text-xs">Season overview · {clients.length} clients · {stats.completedMows.length} sessions</p>
            </div>

            {/* ── HERO CARD ── Revenue + Profit ── */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
                <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-widest text-primary/70 font-medium">Total Revenue</p>
                            <h2 className="text-3xl font-black text-white mt-0.5">{fmtMoney(stats.totalIncome)}</h2>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${stats.netIncome >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {stats.netIncome >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {stats.profitMargin.toFixed(0)}% margin
                            </div>
                            <p className="text-[11px] text-muted-foreground">{fmtMoney(stats.effectiveHourlyRate)}/hr effective</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                            <p className="text-[10px] text-muted-foreground uppercase">Net Profit</p>
                            <p className={`text-sm font-bold ${stats.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {fmtMoney(stats.netIncome)}
                            </p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                            <p className="text-[10px] text-muted-foreground uppercase">Gas</p>
                            <p className="text-sm font-bold text-orange-400">{fmtMoney(stats.totalGas)}</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                            <p className="text-[10px] text-muted-foreground uppercase">Repairs</p>
                            <p className="text-sm font-bold text-red-400">{fmtMoney(stats.totalMaint)}</p>
                        </div>
                    </div>
                    {stats.gasSparkline.length >= 2 && (
                        <div className="mt-3">
                            <p className="text-[10px] text-muted-foreground uppercase mb-1">Gas Cost Trend</p>
                            <Sparkline data={stats.gasSparkline} color="#ff6b35" />
                        </div>
                    )}
                </CardContent>
            </Card>

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
                {/* Financial Bar Chart */}
                <Card className="border-white/10 bg-white/[0.02]">
                    <CardHeader className="pb-1 pt-3 px-4">
                        <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5" /> Financial Overview
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <div className="h-[180px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={incomeData} barCategoryGap="25%">
                                    <XAxis dataKey="name" stroke="#6b8c6b" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#6b8c6b" fontSize={10} tickLine={false} axisLine={false}
                                        tickFormatter={(v) => `$${v}`} width={45} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                        contentStyle={{ backgroundColor: '#0a0f0d', borderColor: 'rgba(170,255,0,0.2)', borderRadius: '10px', fontSize: 12 }}
                                    />
                                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                        {incomeData.map((entry, i) => (
                                            <Cell key={i} fill={i === 1 ? '#ff4444' : i === 2 ? '#22c55e' : '#aaff00'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Time Distribution */}
                <Card className="border-white/10 bg-white/[0.02]">
                    <CardHeader className="pb-1 pt-3 px-4">
                        <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Time Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 flex items-center gap-4">
                        <div className="h-[120px] w-[120px] flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={timeData} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                                        paddingAngle={4} dataKey="value" stroke="none">
                                        {timeData.map((_, i) => (
                                            <Cell key={i} fill={COLORS_TIME[i]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-2.5">
                            {timeData.map((d, i) => (
                                <div key={d.name} className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS_TIME[i] }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-muted-foreground">{d.name}</p>
                                    </div>
                                    <p className="text-xs font-bold text-foreground">{fmtHrs(d.value)}</p>
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
