/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useStore, BillingType } from "@/lib/store";
import { computeClientProfit, computeEquipmentAlerts } from "@/lib/selectors";
import { AddAddressForm } from "@/components/AddAddressForm";
import { Button } from "@/components/ui/button";
import { SwipeableClientCard } from "@/components/SwipeableClientCard";
import { MapPin, Timer, ListTodo, Plus, AlertTriangle } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { SettingsModal } from "@/components/SettingsModal";
import { cn } from "@/lib/utils";

// Predictable avatar colors based on string hash
const generateAvatarStyle = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        { bg: "bg-emerald-900/40", text: "text-emerald-400" },
        { bg: "bg-purple-900/40", text: "text-purple-400" },
        { bg: "bg-orange-900/40", text: "text-orange-400" },
        { bg: "bg-blue-900/40", text: "text-blue-400" },
        { bg: "bg-pink-900/40", text: "text-pink-400" },
    ];
    return colors[Math.abs(hash) % colors.length];
};

// Equipment alerts banner
function EquipmentAlertBanner() {
    const equipment = useStore((s) => s.equipment);
    const alerts = useMemo(() => computeEquipmentAlerts(), [equipment]);
    if (alerts.length === 0) return null;

    const overdueCount = alerts.filter(a => a.isOverdue).length;

    return (
        <div className={cn(
            "mb-6 px-4 py-3 rounded-xl border flex items-center gap-3",
            overdueCount > 0
                ? "bg-red-500/10 border-red-500/30"
                : "bg-orange-500/10 border-orange-500/30"
        )}>
            <AlertTriangle className={cn("w-5 h-5 flex-shrink-0", overdueCount > 0 ? "text-red-400" : "text-orange-400")} />
            <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-bold", overdueCount > 0 ? "text-red-400" : "text-orange-400")}>
                    {overdueCount > 0 ? `${overdueCount} Overdue` : 'Upcoming'} Maintenance
                </p>
                <p className="text-xs text-muted-foreground truncate">
                    {alerts[0].equipmentName}: {alerts[0].serviceName} ({alerts[0].hoursSinceService.toFixed(1)}h / {alerts[0].intervalHours}h)
                </p>
            </div>
        </div>
    );
}

// Inline mow timer component
function InlineMowTimer({ startTime, breakTimeTotal = 0, stuckTimeTotal = 0, status, endTime, currentBreakOrStuckStartTime = null }: { startTime: string, breakTimeTotal?: number, stuckTimeTotal?: number, status: string, endTime: string | null, currentBreakOrStuckStartTime?: string | null }) {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === 'active') {
            const start = new Date(startTime).getTime();
            interval = setInterval(() => {
                setElapsed(Math.floor((new Date().getTime() - start) / 1000) - breakTimeTotal - stuckTimeTotal);
            }, 1000);
        } else {
            const start = new Date(startTime).getTime();
            const frozenEnd = endTime
                ? new Date(endTime).getTime()
                : (currentBreakOrStuckStartTime ? new Date(currentBreakOrStuckStartTime).getTime() : new Date().getTime());
            setElapsed(Math.floor((frozenEnd - start) / 1000) - breakTimeTotal - stuckTimeTotal);
        }
        return () => clearInterval(interval);
    }, [startTime, breakTimeTotal, stuckTimeTotal, status, endTime, currentBreakOrStuckStartTime]);

    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    const timeStr = h > 0
        ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    return <span>{timeStr}</span>;
}

export default function AddressesPage() {
    const { clients, sessions, startMowSession, endMowSession, activeMowSessionId, gasLogs, maintenanceLogs } = useStore();

    const activeSession = sessions.find(s => s.id === activeMowSessionId);

    const [isMounted, setIsMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<BillingType | 'All'>('Regular');

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const regularClients = clients.filter((c) => c.billingType === "Regular");
    const perCutClients = clients.filter((c) => c.billingType === "PerCut");

    if (!isMounted) return null;

    const handleStartMowing = (clientId: string) => {
        startMowSession(clientId);
    };

    const handleCompleteMowing = () => {
        endMowSession();
    };

    const getClientStats = (clientId: string) => {
        const clientSessions = sessions.filter((s) => s.clientId === clientId && s.status === 'completed');
        const totalVisits = clientSessions.length;
        let avgTime = "N/A";
        let totalTimeStr = "0h 0m 0s";
        let daysSince = "N/A";
        let daysSinceNum = -1;
        let totalStuckStr = "0m 0s";
        let totalBreakStr = "0m 0s";

        if (totalVisits > 0) {
            const totalTimeMs = clientSessions.reduce((acc, s) => {
                if (!s.endTime) return acc;
                return acc + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime());
            }, 0);

            const hours = Math.floor(totalTimeMs / 3600000);
            const mins = Math.floor((totalTimeMs % 3600000) / 60000);
            const secs = Math.floor((totalTimeMs % 60000) / 1000);
            totalTimeStr = `${hours}h ${mins}m ${secs}s`;

            const avgMs = totalTimeMs / totalVisits;
            const avgMins = Math.floor(avgMs / 60000);
            const avgSecs = Math.floor((avgMs % 60000) / 1000);
            avgTime = `${avgMins}m ${avgSecs}s`;

            const totalStuckSecs = clientSessions.reduce((acc, s) => acc + (s.stuckTimeTotal || 0), 0);
            const stuckMins = Math.floor(totalStuckSecs / 60);
            const stuckSecsRemainder = totalStuckSecs % 60;
            totalStuckStr = `${stuckMins}m ${stuckSecsRemainder}s`;

            const totalBreakSecs = clientSessions.reduce((acc, s) => acc + (s.breakTimeTotal || 0), 0);
            const breakMins = Math.floor(totalBreakSecs / 60);
            const breakSecsRemainder = totalBreakSecs % 60;
            totalBreakStr = `${breakMins}m ${breakSecsRemainder}s`;

            const lastVisit = new Date(clientSessions[clientSessions.length - 1].startTime);
            const diffTime = Math.abs(new Date().getTime() - lastVisit.getTime());
            daysSinceNum = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            daysSince = `${daysSinceNum} days ago`;
        }

        return { totalVisits, totalTimeStr, avgTime, daysSince, daysSinceNum, clientSessions, totalStuckStr, totalBreakStr };
    };

    const displayClients = activeTab === 'All' ? clients : activeTab === 'Regular' ? regularClients : perCutClients;

    return (
        <main className="p-4 md:p-8 pb-28 min-h-screen bg-[#0a0f0d]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pt-4">
                <div className="flex items-start gap-4">
                    <ListTodo className="w-8 h-8 text-primary mt-1" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
                            Saved Addresses
                        </h1>
                        <p className="text-muted-foreground text-sm">Swipe cards to view stats & routes</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <SettingsModal />
                    <AddAddressForm
                        customTrigger={
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-[0_0_15px_rgba(170,255,0,0.15)] transition-all">
                                <Plus className="w-5 h-5 mr-2" /> Add New Address
                            </Button>
                        }
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 mb-8 bg-[#151a17] w-fit p-1 rounded-xl glass-card border border-white/5">
                <button
                    onClick={() => setActiveTab('Regular')}
                    className={cn(
                        "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                        activeTab === 'Regular'
                            ? "bg-primary text-black shadow-sm"
                            : "text-muted-foreground hover:text-white"
                    )}
                >
                    Regular ({regularClients.length})
                </button>
                <button
                    onClick={() => setActiveTab('PerCut')}
                    className={cn(
                        "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                        activeTab === 'PerCut'
                            ? "bg-primary text-black shadow-sm"
                            : "text-muted-foreground hover:text-white"
                    )}
                >
                    Per Cut ({perCutClients.length})
                </button>
            </div>

            <EquipmentAlertBanner />

            {displayClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-primary/20 rounded-2xl bg-[#151a17]/50 glass-card">
                    <MapPin className="w-12 h-12 text-primary/40 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No clients found</h3>
                    <p className="text-sm text-muted-foreground mb-4">You have no clients in this category.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {displayClients.map((client) => {
                        const stats = getClientStats(client.id);
                        const avatarStyle = generateAvatarStyle(client.name);
                        const isActiveMowing = activeSession?.clientId === client.id;
                        const profit = computeClientProfit(client.id);

                        return (
                            <SwipeableClientCard
                                key={client.id}
                                client={client}
                                stats={{
                                    totalVisits: stats.totalVisits,
                                    totalTimeStr: stats.totalTimeStr,
                                    avgTime: stats.avgTime,
                                    daysSince: stats.daysSince,
                                    daysSinceNum: stats.daysSinceNum,
                                    totalStuckStr: stats.totalStuckStr,
                                    totalBreakStr: stats.totalBreakStr,
                                }}
                                profit={profit}
                                isActiveMowing={isActiveMowing}
                                activeSession={isActiveMowing && activeSession ? {
                                    startTime: activeSession.startTime,
                                    breakTimeTotal: activeSession.breakTimeTotal,
                                    stuckTimeTotal: activeSession.stuckTimeTotal,
                                    currentBreakOrStuckStartTime: activeSession.currentBreakOrStuckStartTime,
                                    status: activeSession.status,
                                    endTime: activeSession.endTime,
                                } : null}
                                avatarStyle={avatarStyle}
                                onStartMowing={() => handleStartMowing(client.id)}
                                onCompleteMowing={handleCompleteMowing}
                                InlineMowTimer={InlineMowTimer}
                            />
                        );
                    })}
                </div>
            )}
        </main>
    );
}
