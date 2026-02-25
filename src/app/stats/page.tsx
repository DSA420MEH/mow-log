/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, Banknote, Fuel, Wrench, Briefcase } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

import { useState, useEffect } from "react";

export default function StatsPage() {
    const { clients, sessions, gasLogs, maintenanceLogs } = useStore();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;

    // Time aggregation
    const completedMowSessions = sessions.filter(s => s.type === 'address-mow' && s.status === 'completed' && s.endTime);
    const completedWorkdaySessions = sessions.filter(s => s.type === 'workday' && s.status === 'completed' && s.endTime);

    const totalBreakTimeSec = completedWorkdaySessions.reduce((acc, s) => acc + s.breakTimeTotal, 0);
    const totalWorkTimeSec = completedWorkdaySessions.reduce((acc, s) => {
        return acc + (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) / 1000 - s.breakTimeTotal;
    }, 0);

    const totalMowingTimeSec = completedMowSessions.reduce((acc, s) => {
        return acc + (new Date(s.endTime!).getTime() - new Date(s.startTime).getTime()) / 1000 - s.breakTimeTotal;
    }, 0);

    const formatHrs = (sec: number) => (sec / 3600).toFixed(1) + "h";

    // Financial aggregation
    const totalGasPaid = gasLogs.reduce((acc, l) => acc + l.total, 0);
    const totalMaintCost = maintenanceLogs.reduce((acc, l) => acc + l.totalCost, 0);

    // Calculate Income: Regular (monthly) + Per Cut (per session)
    // For simplicity, we assume Regular is full amount, and Per Cut is amount * visits
    let totalIncome = 0;
    clients.forEach(c => {
        if (c.billingType === 'Regular') {
            totalIncome += c.amount; // Monthly base
        } else {
            const visits = completedMowSessions.filter(s => s.clientId === c.id).length;
            totalIncome += (c.amount * visits);
        }
    });

    const netIncome = totalIncome - totalGasPaid - totalMaintCost;

    // Chart Data
    const timeData = [
        { name: "Mowing", value: totalMowingTimeSec > 0 ? totalMowingTimeSec : 1 },
        { name: "Breaks", value: totalBreakTimeSec > 0 ? totalBreakTimeSec : 1 }
    ];
    const COLORS = ['#aaff00', '#1a3a1a'];

    const incomeData = [
        { name: "Gross", amount: totalIncome },
        { name: "Expenses", amount: totalGasPaid + totalMaintCost },
        { name: "Net", amount: netIncome > 0 ? netIncome : 0 }
    ];

    return (
        <main className="p-4 pb-28 min-h-screen space-y-6">
            <div className="pt-4 mb-4">
                <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1"><span className="text-primary">Business</span> Analytics</h1>
                <p className="text-muted-foreground text-sm">Dashboard & KPIs</p>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-2 gap-3">
                {/* Income Card */}
                <Card className="glass-card border-primary/40 bg-primary/10 col-span-2">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-primary/80 uppercase tracking-wider mb-1">Gross Income</p>
                            <h2 className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(170,255,0,0.5)]">${totalIncome.toFixed(2)}</h2>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                            <Banknote className="w-6 h-6 text-primary" />
                        </div>
                    </CardContent>
                </Card>

                {/* Time Cards */}
                <Card className="glass-card border-white/10 bg-card/20">
                    <CardContent className="p-4">
                        <Timer className="w-5 h-5 text-primary mb-2 opacity-80" />
                        <p className="text-xs text-muted-foreground uppercase mb-1">Total Mowing</p>
                        <p className="text-xl font-bold text-foreground">{formatHrs(totalMowingTimeSec)}</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10 bg-card/20">
                    <CardContent className="p-4">
                        <Briefcase className="w-5 h-5 text-primary mb-2 opacity-80" />
                        <p className="text-xs text-muted-foreground uppercase mb-1">Total Work</p>
                        <p className="text-xl font-bold text-foreground">{formatHrs(totalWorkTimeSec)}</p>
                    </CardContent>
                </Card>

                {/* Expense Cards */}
                <Card className="glass-card border-white/10 bg-card/20">
                    <CardContent className="p-4">
                        <Fuel className="w-5 h-5 text-destructive mb-2 opacity-80" />
                        <p className="text-xs text-muted-foreground uppercase mb-1">Gas Paid</p>
                        <p className="text-xl font-bold text-foreground">${totalGasPaid.toFixed(2)}</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10 bg-card/20">
                    <CardContent className="p-4">
                        <Wrench className="w-5 h-5 text-destructive mb-2 opacity-80" />
                        <p className="text-xs text-muted-foreground uppercase mb-1">Maintenance</p>
                        <p className="text-xl font-bold text-foreground">${totalMaintCost.toFixed(2)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* CHARTS */}
            <Card className="glass-card border-white/10 bg-card/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-widest">Financial Overview</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={incomeData}>
                                <XAxis dataKey="name" stroke="#6b8c6b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#6b8c6b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#0a0f0d', borderColor: 'rgba(170,255,0,0.3)', borderRadius: '8px' }}
                                />
                                <Bar dataKey="amount" fill="#aaff00" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="glass-card border-white/10 bg-card/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-widest">Time Distribution</CardTitle>
                </CardHeader>
                <CardContent className="pt-2 flex items-center justify-between">
                    <div className="h-[140px] w-[140px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={timeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {timeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex-1 pl-4 space-y-3">
                        <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full bg-primary mr-2"></div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase">Mowing</p>
                                <p className="font-bold">{formatHrs(totalMowingTimeSec)}</p>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full bg-[#1a3a1a] mr-2"></div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase">Breaks</p>
                                <p className="font-bold">{formatHrs(totalBreakTimeSec)}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

        </main>
    );
}
