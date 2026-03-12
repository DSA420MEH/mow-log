/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useStore, BillingType, Client } from "@/lib/store";
import { computeClientProfit, computeEquipmentAlerts } from "@/lib/selectors";
import { ClientForm } from "@/components/ClientForm";
import { Button } from "@/components/ui/button";
import { SwipeableClientCard } from "@/components/SwipeableClientCard";
import { MapPin, Plus, AlertTriangle, Scissors } from "lucide-react";
import { useState, useEffect } from "react";
import { SettingsModal } from "@/components/SettingsModal";
import { cn } from "@/lib/utils";
import { getSeedData } from "@/lib/seed-data";
import { WeatherWidget } from "@/components/WeatherWidget";
import { useCutHeight } from "@/hooks/use-cut-height";
import { useLawnIntelligence } from "@/hooks/use-lawn-intelligence";
import { MowSafetyBanner, BestDayBanner } from "@/components/LawnIntelligence";

// Predictable avatar colors based on string hash
const generateAvatarStyle = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        { bg: "bg-emerald-900/40", text: "text-emerald-400", borderTop: "border-t-emerald-500/50", borderLeft: "hover:border-l-emerald-500/50", shadow: "hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]" },
        { bg: "bg-purple-900/40", text: "text-purple-400", borderTop: "border-t-purple-500/50", borderLeft: "hover:border-l-purple-500/50", shadow: "hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]" },
        { bg: "bg-orange-900/40", text: "text-orange-400", borderTop: "border-t-orange-500/50", borderLeft: "hover:border-l-orange-500/50", shadow: "hover:shadow-[0_0_15px_rgba(249,115,22,0.4)]" },
        { bg: "bg-blue-900/40", text: "text-blue-400", borderTop: "border-t-blue-500/50", borderLeft: "hover:border-l-blue-500/50", shadow: "hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]" },
        { bg: "bg-pink-900/40", text: "text-pink-400", borderTop: "border-t-pink-500/50", borderLeft: "hover:border-l-pink-500/50", shadow: "hover:shadow-[0_0_15px_rgba(236,72,153,0.4)]" },
    ];
    return colors[Math.abs(hash) % colors.length];
};

// Equipment alerts banner
function EquipmentAlertBanner() {
    const equipment = useStore((s) => s.equipment);
    void equipment;
    const alerts = computeEquipmentAlerts();
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
    const { clients, sessions, startMowSession, endMowSession, activeMowSessionId, homeAddress, homeLat, homeLng, hydrated } = useStore();
    const { recommendation: cutHeightRec } = useCutHeight(homeLat || 0, homeLng || 0);
    const { mowSafety, bestDays } = useLawnIntelligence(homeLat || 0, homeLng || 0);

    const activeSession = sessions.find(s => s.id === activeMowSessionId);

    const [isMounted, setIsMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<BillingType | 'All'>('Regular');
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    useEffect(() => {
        setIsMounted(true);
        // Automatically load seed data if the store is empty (first visit or after clear)
        // CRITICAL: We MUST wait for hydration to complete before deciding to seed.
        // Otherwise, the empty initial state will trigger seeding before localStorage is merged.
        if (hydrated && clients.length === 0) {
            const seed = getSeedData();
            useStore.setState({
                clients: seed.clients,
                sessions: seed.sessions,
                gasLogs: seed.gasLogs,
                maintenanceLogs: seed.maintenanceLogs,
                equipment: seed.equipment,
                homeAddress: seed.homeAddress,
                homeLat: seed.homeLat,
                homeLng: seed.homeLng,
                laborRate: seed.laborRate,
                fuelCostPerKm: seed.fuelCostPerKm,
            });
        }
    }, [hydrated, clients.length]);

    const regularClients = clients.filter((c) => c.billingType === "Regular");
    const perCutClients = clients.filter((c) => c.billingType === "PerCut");

    if (!isMounted) return null;

    const handleStartMowing = (clientId: string) => {
        startMowSession(clientId, cutHeightRec?.recommendedHeightIn);
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

    // Dashboard calculations
    const now = new Date();
    // Sort clients: active first, then by days since last cut (descending), then by proximity to home
    const sortedDisplayClients = [...displayClients].sort((a, b) => {
        if (activeSession?.clientId === a.id) return -1;
        if (activeSession?.clientId === b.id) return 1;

        const getDaysSinceNum = (clientId: string) => {
            const clientSessions = sessions.filter((s) => s.clientId === clientId && s.status === 'completed');
            if (clientSessions.length === 0) return 9999;
            const lastVisit = new Date(clientSessions[clientSessions.length - 1].startTime);
            return Math.ceil(Math.abs(now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
        };

        const recencyA = getDaysSinceNum(a.id);
        const recencyB = getDaysSinceNum(b.id);
        if (recencyA !== recencyB) return recencyB - recencyA;

        // Proximity tiebreaker
        if (homeLat && homeLng && a.lat && a.lng && b.lat && b.lng) {
            const distA = Math.pow(a.lat - homeLat, 2) + Math.pow(a.lng - homeLng, 2);
            const distB = Math.pow(b.lat - homeLat, 2) + Math.pow(b.lng - homeLng, 2);
            return distA - distB; // Closest first
        }

        return 0;
    });

    const currentHour = now.getHours();
    const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    const dateString = now.toLocaleDateString('en-US', dateOptions);

    const sevenDaysAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const completedSessionsThisWeek = sessions.filter(
        s => s.status === 'completed' && s.clientId && new Date(s.endTime || s.startTime).getTime() > sevenDaysAgoMs
    );
    const mowsThisWeek = completedSessionsThisWeek.length;

    const revenueThisWeek = completedSessionsThisWeek.reduce((sum, s) => {
        const client = clients.find(c => c.id === s.clientId);
        if (client && client.billingType === 'PerCut') {
            return sum + (client.amount || 0);
        }
        return sum;
    }, 0);
    const avgRevenuePerMowThisWeek = mowsThisWeek > 0 ? revenueThisWeek / mowsThisWeek : 0;

    return (
        <main className="p-4 md:p-8 pb-28 min-h-screen bg-[#0a0f0d] ambient-glow">
            <div className="flex flex-row items-start justify-between gap-4 mb-6 pt-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
                        {greeting}, Fred
                    </h1>
                    <p className="text-muted-foreground text-sm">{dateString}</p>
                </div>

                <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                    <SettingsModal />
                    <ClientForm
                        customTrigger={
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-[0_0_15px_rgba(170,255,0,0.15)] transition-all px-3">
                                <Plus className="w-5 h-5 mr-1" /> Add
                            </Button>
                        }
                    />
                </div>
            </div>

            {/* Today at a glance row */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="bg-[#151a17] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-primary">${revenueThisWeek}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1 text-center">Revenue (7d)</span>
                </div>
                <div className="bg-[#151a17] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{mowsThisWeek}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1 text-center">Mows (7d)</span>
                </div>
                <div className="bg-[#151a17] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">${avgRevenuePerMowThisWeek.toFixed(0)}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1 text-center">Avg / Mow</span>
                </div>
            </div>

            {/* Global Edit Form (triggered via state) */}
            <ClientForm
                initialData={editingClient || undefined}
                open={!!editingClient}
                onOpenChange={(open) => !open && setEditingClient(null)}
            />

            {homeAddress && homeLat && homeLng && (
                <div className="mb-6">
                    <WeatherWidget lat={homeLat} lng={homeLng} />
                </div>
            )}

            {/* Mow Safety Banner */}
            {mowSafety && (
                <div className="mb-6">
                    <MowSafetyBanner safety={mowSafety} />
                </div>
            )}

            {cutHeightRec && (
                <div className={cn(
                    "mb-6 p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden",
                    cutHeightRec.icon === "drought" ? "bg-amber-950/30 border border-amber-500/20" :
                        cutHeightRec.icon === "growth" ? "bg-emerald-950/30 border border-emerald-500/20" :
                            "bg-[#151a17] border border-white/5"
                )}>
                    {/* Background icon */}
                    <Scissors className={cn(
                        "absolute -right-4 -bottom-4 w-32 h-32 opacity-[0.03]",
                        cutHeightRec.icon === "drought" ? "text-amber-500" :
                            cutHeightRec.icon === "growth" ? "text-emerald-500" :
                                "text-white"
                    )} />

                    <div className={cn(
                        "flex items-center justify-center shrink-0 w-16 h-16 rounded-xl",
                        cutHeightRec.icon === "drought" ? "bg-amber-500/10 text-amber-500" :
                            cutHeightRec.icon === "growth" ? "bg-emerald-500/10 text-emerald-500" :
                                "bg-white/5 text-white"
                    )}>
                        <Scissors className="w-8 h-8" />
                    </div>

                    <div className="flex-1 relative z-10">
                        <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-2xl font-black text-white">{cutHeightRec.recommendedHeightIn.toFixed(1)}&quot;</span>
                            <span className={cn(
                                "text-sm font-bold uppercase tracking-wider",
                                cutHeightRec.icon === "drought" ? "text-amber-500" :
                                    cutHeightRec.icon === "growth" ? "text-emerald-500" :
                                        "text-muted-foreground"
                            )}>
                                {cutHeightRec.icon === "drought" ? "Drought Risk" : cutHeightRec.icon === "growth" ? "Fast Growth" : "Standard"}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground/80 leading-snug">
                            {cutHeightRec.explanation}
                        </p>
                    </div>
                </div>
            )}

            {/* Best Day to Mow This Week */}
            {bestDays && (
                <div className="mb-8">
                    <BestDayBanner bestDays={bestDays} />
                </div>
            )}

            <div className="flex items-center gap-2 mb-8 bg-[#151a17] w-fit p-1 rounded-xl glass-card border border-white/5">
                <button
                    onClick={() => setActiveTab('Regular')}
                    className={cn(
                        "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                        activeTab === 'Regular'
                            ? "bg-primary text-black shadow-sm shadow-[0_0_10px_rgba(195,255,0,0.2)]"
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
                            ? "bg-primary text-black shadow-sm shadow-[0_0_10px_rgba(195,255,0,0.2)]"
                            : "text-muted-foreground hover:text-white"
                    )}
                >
                    Per Cut ({perCutClients.length})
                </button>
            </div>

            <EquipmentAlertBanner />

            {sortedDisplayClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-primary/20 rounded-2xl bg-[#151a17]/50 glass-card">
                    <MapPin className="w-12 h-12 text-primary/40 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No clients found</h3>
                    <p className="text-sm text-muted-foreground mb-4">You have no clients in this category.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
                    {sortedDisplayClients.map((client) => {
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
                                cutHeight={cutHeightRec}
                                onStartMowing={() => handleStartMowing(client.id)}
                                onCompleteMowing={handleCompleteMowing}
                                onEdit={() => setEditingClient(client)}
                                InlineMowTimer={InlineMowTimer}
                            />
                        );
                    })}
                </div>
            )}
        </main>
    );
}
