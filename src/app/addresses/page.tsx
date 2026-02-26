/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useStore, BillingType } from "@/lib/store";
import { useClientProfit, useEquipmentAlerts, type ClientProfitData } from "@/lib/selectors";
import { AddAddressForm } from "@/components/AddAddressForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Pencil, Timer, ListTodo, Plus, Search, Route, TrendingUp, TrendingDown, AlertTriangle, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

const getInitials = (name: string) => {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
};

// Profit badge shown on each client card — calls useClientProfit hook
function ClientProfitBadge({ clientId }: { clientId: string }) {
    const profit = useClientProfit(clientId);
    if (profit.revenue === 0 && profit.profit === 0) return null;

    const isPositive = profit.profit >= 0;
    const fmtMoney = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(0);

    return (
        <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold",
            isPositive ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
        )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {fmtMoney(profit.profit)}
        </div>
    );
}

// Equipment alerts banner
function EquipmentAlertBanner() {
    const alerts = useEquipmentAlerts();
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

export default function AddressesPage() {
    const { clients, sessions, startMowSession, endMowSession, activeMowSessionId } = useStore();
    const router = useRouter();

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
        // Removed router.push("/logs");
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

        return { totalVisits, totalTimeStr, daysSince, daysSinceNum, clientSessions, totalStuckStr, totalBreakStr };
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
                        <p className="text-muted-foreground text-sm">Manage your route and client details</p>
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
                        const { totalVisits, totalTimeStr, daysSince, daysSinceNum, totalStuckStr, totalBreakStr } = getClientStats(client.id);
                        const avatarStyle = generateAvatarStyle(client.name);
                        const isActiveMowing = activeSession?.clientId === client.id;

                        let daysSinceColor = "text-primary bg-primary/10";
                        if (daysSinceNum > 10) daysSinceColor = "text-rose-400 bg-rose-500/10";
                        else if (daysSinceNum > 5) daysSinceColor = "text-orange-400 bg-orange-500/10";

                        const [street, cityZip] = client.address.split(', ');

                        return (
                            <div key={client.id} className={cn(
                                "glass-card rounded-2xl bg-[#1a201c] border p-5 relative overflow-hidden flex flex-col transition-colors",
                                isActiveMowing ? "border-primary shadow-[0_0_15px_rgba(170,255,0,0.1)]" : "border-white/5 hover:border-primary/20",
                            )}>
                                {isActiveMowing && (
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-70"></div>
                                )}

                                {/* Route Link / Thumbnail */}
                                {client.lat && client.lng && (
                                    <button
                                        onClick={() => router.push(`/route-planner?lat=${client.lat}&lng=${client.lng}`)}
                                        className="mb-4 w-full rounded-xl overflow-hidden border border-white/10 hover:border-primary/40 transition-colors group relative bg-white/[0.03]"
                                    >
                                        {(client.routeScreenshot && client.routeScreenshot.startsWith('data:image')) ? (
                                            <>
                                                <img
                                                    src={client.routeScreenshot}
                                                    alt={`Route for ${client.name}`}
                                                    className="w-full h-24 object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="text-xs font-semibold text-white">Open Route</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="w-full h-10 flex items-center justify-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                                                <Route className="w-4 h-4" />
                                                <span className="text-xs font-semibold">Open Saved Route</span>
                                            </div>
                                        )}
                                    </button>
                                )}

                                <div className="flex items-start justify-between mb-5 relative z-10">
                                    <div className="flex gap-4 items-start">
                                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg", avatarStyle.bg, avatarStyle.text)}>
                                            {getInitials(client.name)}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white leading-none mb-1.5">{client.name}</h3>
                                            <div className="text-sm text-muted-foreground flex items-start gap-1">
                                                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                                <div className="flex flex-col leading-tight">
                                                    <span className="text-gray-300">{street || client.address}</span>
                                                    {cityZip && <span className="text-xs mt-0.5 opacity-70 uppercase tracking-wider">{cityZip}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="text-muted-foreground hover:text-white transition-colors">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Profit Badge */}
                                <div className="flex items-center gap-2 mb-3">
                                    <ClientProfitBadge clientId={client.id} />
                                    <span className="text-[11px] text-muted-foreground">
                                        {client.billingType === 'Regular' ? `$${client.amount}/mo` : `$${client.amount}/cut`}
                                    </span>
                                </div>

                                {isActiveMowing && activeSession && (
                                    <div className="mb-4 py-2 border-y border-primary/20 flex items-center justify-center gap-2">
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

                                <div className="grid grid-cols-2 gap-px bg-white/5 rounded-xl overflow-hidden mb-4 border border-white/5 text-sm">
                                    <div className="bg-[#151a17] p-3 flex flex-col justify-center">
                                        <span className="text-[10px] text-primary/70 font-bold tracking-wider mb-1 uppercase">Phone</span>
                                        <span className="text-gray-200 font-medium">{client.phone || 'N/A'}</span>
                                    </div>
                                    <div className="bg-[#151a17] p-3 flex flex-col justify-center overflow-hidden">
                                        <span className="text-[10px] text-primary/70 font-bold tracking-wider mb-1 uppercase">Size</span>
                                        <span className="text-gray-200 font-medium truncate">{client.sqft}</span>
                                    </div>
                                    <div className="bg-[#151a17] p-3 flex flex-col justify-center">
                                        <span className="text-[10px] text-primary/70 font-bold tracking-wider mb-1 uppercase">Visits</span>
                                        <span className="text-gray-200 font-medium">{totalVisits}</span>
                                    </div>
                                    <div className="bg-[#151a17] p-3 flex flex-col justify-center">
                                        <span className="text-[10px] text-primary/70 font-bold tracking-wider mb-1 uppercase">Total Time</span>
                                        <span className="text-gray-200 font-medium">{totalTimeStr}</span>
                                    </div>
                                    <div className="bg-[#151a17] p-3 flex flex-col justify-center">
                                        <span className="text-[10px] text-primary/70 font-bold tracking-wider mb-1 uppercase">Stuck Time</span>
                                        <span className="text-rose-400 font-medium">{totalStuckStr}</span>
                                    </div>
                                    <div className="bg-[#151a17] p-3 flex flex-col justify-center">
                                        <span className="text-[10px] text-primary/70 font-bold tracking-wider mb-1 uppercase">Pause Time</span>
                                        <span className="text-gray-400 font-medium">{totalBreakStr}</span>
                                    </div>
                                </div>

                                <div className="mt-auto pt-2 flex items-center justify-between">
                                    {daysSinceNum >= 0 ? (
                                        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap", daysSinceColor)}>
                                            {daysSince}
                                        </span>
                                    ) : (
                                        <span className="text-xs px-2.5 py-1 rounded-full font-medium text-muted-foreground bg-white/5">
                                            Never
                                        </span>
                                    )}

                                    {isActiveMowing ? (
                                        <Button
                                            onClick={handleCompleteMowing}
                                            className="bg-white hover:bg-white/90 text-black font-bold shadow-[0_4px_15px_rgba(255,255,255,0.2)] transition-all active:scale-[0.97]"
                                        >
                                            Complete Mowing
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={() => handleStartMowing(client.id)}
                                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_4px_15px_rgba(170,255,0,0.2)] transition-all active:scale-[0.97]"
                                        >
                                            <Timer className="w-4 h-4 mr-2" />
                                            Start Mowing
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
}

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
