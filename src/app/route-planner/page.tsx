"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useState, useRef } from "react";
import {
    MapPin, Navigation, Home, Route as RouteIcon, ExternalLink,
    Fuel, ArrowLeft, Zap, GripVertical, PauseCircle, Play,
    AlertTriangle, CheckCircle2, Image as ImageIcon, Clock,
    Pencil, X, Save
} from "lucide-react";
import { useStore } from "@/lib/store";
import { optimizeRoute, recalculateRoute, type OptimizedRoute } from "@/lib/route-optimizer";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ClientForm } from "@/components/ClientForm";
import { calculateLawnArea, type MowingStats } from "@/lib/lawn-intelligence";
import type { Feature, Polygon } from "geojson";

import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { HudPanel } from "@/components/HudPanel";
import { usePersistentMapState } from "@/hooks/usePersistentMapState";

const UnifiedGameMap = dynamic(() => import("@/components/UnifiedGameMap"), {
    ssr: false,
    loading: () => (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
            <div className="text-center animate-pulse">
                <Zap className="w-12 h-12 text-primary mx-auto mb-2" />
                <p className="text-primary text-sm font-mono tracking-widest">LOADING MAP_SYSTEM...</p>
            </div>
        </div>
    )
});

function InlineMowTimer({
    startTime, breakTimeTotal = 0, stuckTimeTotal = 0, status, endTime, currentBreakOrStuckStartTime = null
}: {
    startTime: string, breakTimeTotal?: number, stuckTimeTotal?: number, status: string, endTime: string | null, currentBreakOrStuckStartTime?: string | null
}) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const updateTimer = () => {
            const start = new Date(startTime).getTime();
            const end = (status === 'completed' && endTime) ? new Date(endTime).getTime() : Date.now();

            let currentBreakAddition = 0;
            if (status === 'break' && currentBreakOrStuckStartTime) {
                currentBreakAddition = Date.now() - new Date(currentBreakOrStuckStartTime).getTime();
            }

            let currentStuckAddition = 0;
            if (status === 'stuck' && currentBreakOrStuckStartTime) {
                currentStuckAddition = Date.now() - new Date(currentBreakOrStuckStartTime).getTime();
            }

            const totalActiveMs = (end - start) - (breakTimeTotal + currentBreakAddition) - (stuckTimeTotal + currentStuckAddition);
            setElapsed(Math.max(0, Math.floor(totalActiveMs / 1000)));
        };

        updateTimer();
        if (status === 'active') {
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        }
    }, [startTime, breakTimeTotal, stuckTimeTotal, status, endTime, currentBreakOrStuckStartTime]);

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return <>{mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}</>;
}


import type { UnifiedGameMapRef } from "@/components/UnifiedGameMap";

function RoutePlannerContent() {
    const router = useRouter();
    
    // ─── Persistence ───
    const { 
        lat, 
        lng, 
        zoom, 
        selectedId, 
        isHydrating, 
        updateView, 
        updateSelection 
    } = usePersistentMapState();

    const {
        clients, homeAddress, homeLat, homeLng, fuelCostPerKm,
        activeRouteStops, currentRouteStopIndex, startDriveMode, advanceRouteStop, cancelDriveMode,
        startMowSession, endMowSession, toggleMowBreak, toggleMowStuck, sessions, activeMowSessionId,
        activeWorkdaySessionId, startWorkdaySession, endWorkdaySession, toggleWorkdayBreak,
        saveClientRoute, updateClient,
        plannerSelectedClientIds, setPlannerSelectedClientIds,
        plannerOptimizedRoute, setPlannerOptimizedRoute,
    } = useStore();

    const mapRef = useRef<UnifiedGameMapRef>(null);

    const editingClientId = selectedId;
    const setEditingClientId = updateSelection;

    const editingClient = editingClientId ? clients.find(c => c.id === editingClientId) : null;

    const [editingAddressClientId, setEditingAddressClientId] = useState<string | null>(null);
    const editingAddressClient = editingAddressClientId ? clients.find(c => c.id === editingAddressClientId) : null;

    const clientsWithCoords = clients.filter(c => c.lat && c.lng);

    const selectedClientIds = useMemo(() => new Set(plannerSelectedClientIds), [plannerSelectedClientIds]);
    const optimizedRoute = plannerOptimizedRoute;


    // Command Center States
    const [drawMode, setDrawMode] = useState<"lawn" | "obstacle">("lawn");
    const [currentLawnPolygon, setCurrentLawnPolygon] = useState<Feature<Polygon> | null>(null);
    const [currentObstacles, setCurrentObstacles] = useState<Feature<Polygon>[]>([]);
    const [lawnAreaSqFt, setLawnAreaSqFt] = useState<number>(0);
    const [mowingStats, setMowingStats] = useState<MowingStats | null>(null);

    const [completedWorkdayId, setCompletedWorkdayId] = useState<string | null>(null);
    const [showDebriefModal, setShowDebriefModal] = useState(false);

    const debriefStats = useMemo(() => {
        if (!activeRouteStops || !showDebriefModal) return null;
        let totalSqFt = 0;
        let totalEarnings = 0;
        activeRouteStops.forEach(stop => {
            const c = clients.find(cl => cl.id === stop.clientId);
            if (c?.sqft) {
                const sq = parseFloat(c.sqft);
                if (!isNaN(sq)) {
                    totalSqFt += sq;
                    // Formula estimation matching premium industry rates: $45 min + $0.01 per sqft 
                    totalEarnings += Math.max(45, (sq * 0.01)); 
                }
            }
        });
        return { count: activeRouteStops.length, totalSqFt, totalEarnings };
    }, [activeRouteStops, clients, showDebriefModal]);

    // Fly to home base on initial load
    useEffect(() => {
        if (homeLat && homeLng) {
            mapRef.current?.flyToCoords(homeLat, homeLng, 16);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Derived States
    const isFinished = activeRouteStops && currentRouteStopIndex >= activeRouteStops.length;
    const currentStop = activeRouteStops ? activeRouteStops[currentRouteStopIndex] : null;
    const mapUrlForLeg = currentStop ? `https://www.google.com/maps/dir/?api=1&destination=${currentStop.lat},${currentStop.lng}` : "";
    const activeSession = sessions.find(s => s.id === activeMowSessionId);

    // Check if we are physically at the client
    const isMowingCurrent = activeRouteStops && activeMowSessionId && activeSession?.clientId === currentStop?.clientId;
    const fullClient = currentStop ? clients.find(c => c.id === currentStop.clientId) : null;
    const activeWorkday = sessions.find(s => s.id === activeWorkdaySessionId);
    const completedWorkdayInfo = completedWorkdayId ? sessions.find(s => s.id === completedWorkdayId) : null;

    const isDrivingActive = activeRouteStops && activeRouteStops.length > 0 && !completedWorkdayInfo && !isFinished;

    const handleEndWorkDay = () => {
        if (activeWorkdaySessionId) {
            setCompletedWorkdayId(activeWorkdaySessionId);
            endWorkdaySession();
        } else {
            cancelDriveMode();
        }
    };

    const toggleClient = (id: string) => {
        const next = new Set(selectedClientIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setPlannerSelectedClientIds(Array.from(next));
        setPlannerOptimizedRoute(null);
    };

    const selectAll = () => {
        setPlannerSelectedClientIds(clientsWithCoords.map(c => c.id));
        setPlannerOptimizedRoute(null);
    };

    const clearAll = () => {
        setPlannerSelectedClientIds([]);
        setPlannerOptimizedRoute(null);
    };

    const generateDailyRoute = () => {
        if (!homeLat || !homeLng || selectedClientIds.size === 0) return;

        const selected = clientsWithCoords
            .filter(c => selectedClientIds.has(c.id))
            .map(c => ({
                clientId: c.id,
                name: c.name,
                address: c.address,
                lat: c.lat!,
                lng: c.lng!,
                distanceFromPrevKm: 0,
            }));

        const result = optimizeRoute(homeLat, homeLng, selected, fuelCostPerKm);
        setPlannerOptimizedRoute(result);
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || !optimizedRoute || !homeLat || !homeLng) return;

        const items = Array.from(optimizedRoute.stops);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        const newRoute = recalculateRoute(homeLat, homeLng, items, fuelCostPerKm);
        setPlannerOptimizedRoute(newRoute);
    };


    return (
        <div className="relative w-full h-full min-h-[100dvh] overflow-hidden bg-black text-foreground font-sans">
            {/* 1. Map Background (Z: 0) */}
            <UnifiedGameMap 
                ref={mapRef}
                editingClientId={editingClientId} 
                drawMode={drawMode}
                onViewChange={(center, zoom) => updateView(center.lat, center.lng, zoom)}
                initialView={lat && lng && zoom ? { lat, lng, zoom } : undefined}
                onDataChange={(lawn, obs) => {
                    setCurrentLawnPolygon(lawn);
                    setCurrentObstacles(obs);
                    if (lawn) {
                        const area = calculateLawnArea(lawn);
                        setLawnAreaSqFt(area);
                    } else {
                        setLawnAreaSqFt(0);
                    }
                }}
                onSaveBoundaries={(clientId, lawnBoundary, obstacles) => {
                    const client = clients.find(c => c.id === clientId);
                    if (client && client.lat && client.lng) {
                        saveClientRoute(clientId, client.routeScreenshot || '', client.lat, client.lng, lawnBoundary || undefined, obstacles.length > 0 ? obstacles : undefined);
                    }
                    setEditingClientId(null);
                }} 
                onPinMoved={(clientId, lat, lng) => {
                    updateClient(clientId, { lat, lng });
                }}
                onClientClick={toggleClient}
                onStatsUpdate={(stats) => {
                    setMowingStats(stats);
                }}
            />

            {/* 2. HUD Overlays (Z: 50) */}
            <div className="absolute inset-0 z-50 pointer-events-none flex flex-col justify-between">

                {/* ─── TOP HUD ─── */}
                <header className={`w-full flex justify-between items-start p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent ${editingClientId ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                    {/* Left: Branding & Back */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push("/addresses")}
                                className="w-10 h-10 rounded-full bg-black/50 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 hover:border-white/30 transition-all backdrop-blur-md"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <h1 className="text-xl font-black uppercase tracking-widest text-white drop-shadow-md">
                                <span className="text-primary">Mow</span>Log <span className="text-white/30">|</span> HUD
                            </h1>
                        </div>
                    </div>

                    {/* Right: Master Shift Timer */}
                    {activeWorkday && !completedWorkdayInfo && (
                        <div className="premium-glass glass-edge-highlight border border-primary/30 rounded-xl p-3 shadow-[0_0_20px_rgba(204,255,0,0.1)] flex items-center gap-4">
                            <div>
                                <div className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5 opacity-80">
                                    <Clock className="w-3 h-3" /> Shift Timer
                                </div>
                                <div className="text-2xl font-mono text-white font-black tracking-tighter drop-shadow-lg">
                                    <InlineMowTimer
                                        startTime={activeWorkday.startTime}
                                        breakTimeTotal={activeWorkday.breakTimeTotal}
                                        currentBreakOrStuckStartTime={activeWorkday.currentBreakOrStuckStartTime}
                                        status={activeWorkday.status}
                                        endTime={activeWorkday.endTime}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={toggleWorkdayBreak}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${activeWorkday.status === 'break' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'glass-card hover:glass-card-hover text-white border border-white/20'}`}
                            >
                                {activeWorkday.status === 'break' ? 'Resume' : 'Pause'}
                            </button>
                        </div>
                    )}
                </header>


                {/* ─── MIDDLE HUD (SIDEBAR) ─── */}
                <div className="flex-1 w-full px-4 overflow-hidden flex items-stretch pointer-events-none relative">

                    {/* COMMAND CENTER SIDEBAR (When Editing Client) */}
                    {editingClient && (
                        <HudPanel 
                            title="Command Center" 
                            subtitle={`EDITING: ${editingClient.name}`}
                            onClose={() => setEditingClientId(null)}
                            accentColor="primary"
                            className="w-80 pointer-events-auto"
                        >
                            <div className="space-y-6">
                                {/* Back to Clients */}
                                <button
                                    onClick={() => setEditingClientId(null)}
                                    className="w-full py-2.5 rounded-lg border border-white/10 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    <ArrowLeft className="w-3 h-3" /> Back to Clients
                                </button>

                                {/* Address Section */}
                                <div className="space-y-3">
                                    <label className="text-[10px] uppercase text-primary/60 tracking-widest font-black flex items-center gap-1.5">
                                        <MapPin className="w-3 h-3" /> Address
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            suppressHydrationWarning
                                            value={editingClient.address}
                                            className="flex-1 px-3 py-2.5 rounded-lg stealth-noir-glass border border-white/10 text-white/60 text-xs font-mono"
                                        />
                                        <button
                                            className="px-3 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors text-[10px] font-black uppercase"
                                            onClick={() => {
                                                mapRef.current?.flyToClient(editingClient.id);
                                            }}
                                        >
                                            Fly To
                                        </button>
                                    </div>
                                    <p className="text-[9px] text-primary/50 flex items-center gap-1">
                                        <Navigation className="w-2.5 h-2.5 shrink-0" />
                                        Drag the pin on the map to correct its position
                                    </p>
                                </div>

                                {/* Draw Tools Section */}
                                <div className="space-y-3">
                                    <label className="text-[10px] uppercase text-primary/60 tracking-widest font-black flex items-center gap-1.5">
                                        <Pencil className="w-3 h-3" /> Draw Tools
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setDrawMode("lawn")}
                                            className={`py-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 ${drawMode === 'lawn'
                                                ? 'bg-primary/20 border-primary/50 text-primary shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                                                : 'glass-card border-white/10 text-white/40 hover:text-white'
                                            }`}
                                        >
                                            <span className="text-xs">🌿</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest">Lawn Boundary</span>
                                        </button>
                                        <button
                                            onClick={() => setDrawMode("obstacle")}
                                            className={`py-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 ${drawMode === 'obstacle'
                                                ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                                : 'glass-card border-white/10 text-white/40 hover:text-white'
                                            }`}
                                        >
                                            <span className="text-xs">⚠️</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest">Obstacle</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Lawn Stats */}
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Total Lawn Area</div>
                                    <div className="text-3xl font-mono font-black text-white tracking-tighter">
                                        {lawnAreaSqFt.toLocaleString()} <span className="text-xs text-white/30 font-sans uppercase ml-1">SQ FT</span>
                                    </div>
                                </div>

                                {/* Mower Settings */}
                                <div className="space-y-4 pt-2">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase text-primary/60 tracking-widest font-black">Mower Size</label>
                                        <Select 
                                            value={editingClient.mowerSize || "54"} 
                                            onValueChange={(val) => {
                                                const mowerType = val === "50" ? "zero-turn" : "standard";
                                                updateClient(editingClient.id, { mowerSize: val, mowerType });
                                            }}
                                        >
                                            <SelectTrigger className="w-full bg-black/40 border-white/10 text-white/80 text-xs h-11 rounded-xl">
                                                <SelectValue placeholder="Select size" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#0a0f0d] border-white/10 text-white">
                                                <SelectItem value="36">36" Compact</SelectItem>
                                                <SelectItem value="48">48" Standard</SelectItem>
                                                <SelectItem value="50">50" Toro TimeCutter (Zero-Turn)</SelectItem>
                                                <SelectItem value="54">54" Large</SelectItem>
                                                <SelectItem value="60">60" Commercial</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase text-primary/60 tracking-widest font-black">Discharge Type</label>
                                        <Select 
                                            value={editingClient.mowerDischarge || "Mulch"} 
                                            onValueChange={(val) => updateClient(editingClient.id, { mowerDischarge: val })}
                                        >
                                            <SelectTrigger className="w-full bg-black/40 border-white/10 text-white/80 text-xs h-11 rounded-xl">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#0a0f0d] border-white/10 text-white">
                                                <SelectItem value="Side">Side Discharge</SelectItem>
                                                <SelectItem value="Mulch">Mulching</SelectItem>
                                                <SelectItem value="Bag">Bagging</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="pt-4 space-y-3">
                                    <button
                                        onClick={() => {
                                            saveClientRoute(editingClient.id, editingClient.routeScreenshot || '', editingClient.lat!, editingClient.lng!, currentLawnPolygon || undefined, currentObstacles.length > 0 ? currentObstacles : undefined);
                                            updateClient(editingClient.id, { sqft: lawnAreaSqFt.toString() });
                                            setEditingClientId(null);
                                        }}
                                        className="w-full py-4 rounded-xl bg-primary text-black font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(204,255,0,0.2)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-4 h-4" /> Save Address & Boundaries
                                    </button>
                                    <button
                                        onClick={() => {
                                            mapRef.current?.generateMowingPattern(editingClient.id);
                                        }}
                                        className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white/40 font-black text-xs uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Zap className="w-4 h-4" /> Generate Mowing Pattern
                                    </button>

                                    {mowingStats && (
                                        <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-500">
                                            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                                                            <Clock className="w-4 h-4 text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">Est. Duration</p>
                                                            <p className="text-xl font-black text-primary leading-none">
                                                                {mowingStats.durationMinutes} <span className="text-xs">MIN</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-white/40 uppercase font-black tracking-widest leading-tight">Total Distance</p>
                                                        <p className="text-sm font-black text-white leading-none">
                                                            {Math.round(mowingStats.distanceFeet).toLocaleString()} <span className="text-[10px] opacity-50">FT</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <div className="h-px bg-white/5" />
                                                
                                                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                                    <div className="flex items-center gap-1.5 text-white/40">
                                                        <Navigation className="w-3 h-3" />
                                                        <span>{mowingStats.passCount} PASSES</span>
                                                    </div>
                                                    <div className="text-primary group flex items-center gap-1">
                                                        <span>ULTRA-EFFICIENT</span>
                                                        <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </HudPanel>
                    )}

                    {/* PLANNER SIDEBAR (Only show when NOT driving AND NOT editing client) */}
                {!isDrivingActive && !completedWorkdayInfo && !isFinished && !editingClient && (
                        <HudPanel
                            title="Route Planner"
                            subtitle={`${clientsWithCoords.length} Clients Managed`}
                            accentColor="primary"
                            className="w-80 pointer-events-auto"
                        >
                            <div className="space-y-5">
                                {/* Base Location (read-only — change in Operator Profile) */}
                                <div>
                                    <label className="text-[10px] uppercase text-muted-foreground tracking-widest font-bold mb-2 flex items-center gap-1">
                                        <Home className="w-3 h-3" /> Base Location
                                    </label>
                                    {homeAddress && homeLat && homeLng ? (
                                        <div className="px-3 py-2 rounded-lg stealth-noir-glass border border-primary/20 flex items-center gap-2">
                                            <span className="flex-1 text-xs font-mono text-white/80 truncate">{homeAddress}</span>
                                            <span className="text-primary shrink-0">✓</span>
                                        </div>
                                    ) : (
                                        <div className="px-3 py-2 rounded-lg stealth-noir-glass border border-red-500/20 flex items-center gap-2">
                                            <span className="flex-1 text-xs font-mono text-white/30 italic">No address set</span>
                                            <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                                        </div>
                                    )}
                                    <p className="text-[9px] text-muted-foreground/50 mt-1.5">
                                        Change this in <span className="text-primary/70">Operator Profile</span>
                                    </p>
                                </div>

                                {/* Target Selection */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] uppercase text-muted-foreground tracking-widest font-bold">
                                            Targets ({clientsWithCoords.length}/{clients.length} GPS LOCK)
                                        </label>
                                        <div className="flex gap-1">
                                            <button onClick={selectAll} className="text-[9px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors uppercase font-bold tracking-wider">All</button>
                                            <button onClick={clearAll} className="text-[9px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors uppercase font-bold tracking-wider">Clr</button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pr-1 custom-scrollbar">
                                        {clients.map(client => {
                                            const hasCoords = !!(client.lat && client.lng);
                                            const isSelected = selectedClientIds.has(client.id);
                                            const hasBoundary = !!client.lawnBoundary;
                                            return (
                                                <div
                                                    key={client.id}
                                                    className={`rounded-xl text-xs transition-all border overflow-hidden ${!hasCoords
                                                        ? "bg-red-500/5 border-red-500/10 opacity-50"
                                                        : isSelected
                                                            ? "stealth-noir-glass border-primary/50 shadow-[0_0_15px_rgba(204,255,0,0.15)]"
                                                            : "glass-card hover:glass-card-hover border-white/10"
                                                        }`}
                                                >
                                                    {/* Top row: checkbox + name + edit */}
                                                    <div className="flex items-center gap-2 px-3 py-2.5">
                                                        {/* Checkbox */}
                                                        <button
                                                            onClick={() => hasCoords && toggleClient(client.id)}
                                                            disabled={!hasCoords}
                                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${!hasCoords
                                                                ? "border-red-500/20 cursor-not-allowed"
                                                                : isSelected
                                                                    ? "border-primary bg-primary text-black"
                                                                    : "border-white/30 hover:border-white/50"
                                                                }`}
                                                        >
                                                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                        </button>

                                                        {/* Name + Address */}
                                                        <button
                                                            onClick={() => hasCoords && toggleClient(client.id)}
                                                            disabled={!hasCoords}
                                                            className="flex-1 text-left min-w-0"
                                                        >
                                                            <div className={`font-bold truncate ${isSelected ? 'text-primary' : hasCoords ? 'text-white/80' : 'text-white/30'}`}>
                                                                {client.name}
                                                            </div>
                                                            <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-primary/60' : 'text-white/30'}`}>
                                                                {client.address || 'No address'}
                                                            </div>
                                                        </button>

                                                        {/* Status indicators */}
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {!hasCoords && (
                                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold uppercase">No GPS</span>
                                                            )}
                                                            {hasCoords && hasBoundary && (
                                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold uppercase" title="Lawn boundary saved">✓ Map</span>
                                                            )}
                                                            {/* Edit Info Button (Always visible) */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingAddressClientId(client.id);
                                                                }}
                                                                className={`w-7 h-7 rounded-lg glass-card hover:glass-card-hover hover:border-primary/30 hover:text-primary text-white/40 flex items-center justify-center transition-all`}
                                                                title="Edit client info"
                                                            >
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                            {/* Edit Boundary Button */}
                                                            {hasCoords && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingClientId(client.id);
                                                                    }}
                                                                    className="w-7 h-7 rounded-lg glass-card hover:glass-card-hover hover:border-emerald-500/30 hover:text-emerald-400 text-white/40 flex items-center justify-center transition-all"
                                                                    title="Edit lawn boundaries"
                                                                >
                                                                    <MapPin className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Generate */}
                                <button
                                    onClick={generateDailyRoute}
                                    disabled={!homeLat || selectedClientIds.size === 0}
                                    className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${homeLat && selectedClientIds.size > 0
                                        ? "bg-primary text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(204,255,0,0.3)]"
                                        : "stealth-noir-glass text-white/20 border border-white/10 cursor-not-allowed"
                                        }`}
                                >
                                    Initiate Route Planning
                                </button>

                                {/* Optimized Output */}
                                {optimizedRoute && optimizedRoute.stops.length > 0 && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pt-2 border-t border-white/10">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Path Compiled</span>
                                            <span className="text-[10px] font-mono text-white/50">{optimizedRoute.totalDistanceKm.toFixed(1)}KM</span>
                                        </div>

                                        <DragDropContext onDragEnd={handleDragEnd}>
                                            <Droppable droppableId="route-stops">
                                                {(provided) => (
                                                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1.5 mb-4">
                                                        {optimizedRoute.stops.map((stop, idx) => (
                                                            <Draggable key={stop.clientId} draggableId={stop.clientId} index={idx}>
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all border ${snapshot.isDragging ? "bg-primary/20 border-primary shadow-xl z-50 backdrop-blur-md" : "glass-card hover:glass-card-hover border-white/10"
                                                                            }`}
                                                                    >
                                                                        <div {...provided.dragHandleProps} className="text-white/20 p-1 cursor-grab active:cursor-grabbing">
                                                                            <GripVertical className="w-3 h-3" />
                                                                        </div>
                                                                        <div className="w-5 h-5 rounded bg-white/10 text-white/50 flex items-center justify-center font-mono text-[9px] shrink-0">
                                                                            {idx + 1}
                                                                        </div>
                                                                        <div className="flex-1 truncate font-bold text-white/90">{stop.name}</div>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </DragDropContext>

                                        <button
                                            onClick={() => {
                                                if (!activeWorkdaySessionId) startWorkdaySession();
                                                startDriveMode(optimizedRoute.stops);
                                            }}
                                            className="w-full py-4 rounded-xl bg-primary text-black font-black text-sm uppercase tracking-widest shadow-[0_0_30px_rgba(204,255,0,0.3)] hover:scale-[1.02] transition-transform animate-pulse"
                                        >
                                            <span className="flex items-center justify-center gap-2"><Zap className="inline w-4 h-4 mr-2 -mt-1" /> Engage Drive Mode</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </HudPanel>
                    )}
                </div>


                {/* ─── BOTTOM HUD (DRIVE / MOW OVERLAYS) ─── */}
                <div className="w-full px-4 pb-28 pt-20 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none flex flex-col items-center justify-end">

                    {/* Shift Complete State */}
                    {completedWorkdayInfo && (
                        <div className="pointer-events-auto premium-glass glass-edge-highlight rounded-3xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-700">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />

                            <div className="w-20 h-20 rounded-full bg-primary/20 text-primary flex items-center justify-center shadow-[0_0_30px_rgba(204,255,0,0.3)] mx-auto mb-6">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>

                            <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-6">Shift Complete</h2>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
                                <div className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Total Duration</div>
                                <div className="text-5xl font-mono font-black text-white tracking-tighter shadow-black drop-shadow-md">
                                    <InlineMowTimer
                                        startTime={completedWorkdayInfo.startTime}
                                        breakTimeTotal={completedWorkdayInfo.breakTimeTotal}
                                        status={completedWorkdayInfo.status}
                                        endTime={completedWorkdayInfo.endTime}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => { setCompletedWorkdayId(null); cancelDriveMode(); }}
                                className="w-full py-4 rounded-xl font-black uppercase tracking-widest glass-card hover:glass-card-hover text-white transition-all border border-white/20"
                            >
                                Return to Command Center
                            </button>
                        </div>
                    )}

                    {/* Returning Home State */}
                    {isFinished && !completedWorkdayInfo && (
                        <div className="pointer-events-auto premium-glass glass-edge-highlight rounded-3xl p-6 max-w-md w-full text-center shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 mx-auto mb-4">
                                <Home className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-black text-white tracking-tight uppercase mb-1">Return to base</h2>
                            <p className="text-white/50 text-sm mb-6">Zero targets remaining in queue.</p>

                            <button
                                onClick={handleEndWorkDay}
                                className="w-full py-4 bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30 rounded-xl font-black uppercase tracking-widest transition-colors"
                            >
                                End Operations
                            </button>
                        </div>
                    )}

                    {/* Active Drive / Mow State */}
                    {isDrivingActive && currentStop && (
                        <div className="w-full max-w-3xl pointer-events-auto relative">
                            {/* Abort button floating above the panel */}
                            <button
                                onClick={cancelDriveMode}
                                className="absolute -top-12 right-0 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-widest border border-red-500/30 hover:bg-red-500/30 transition-colors"
                            >
                                [ABORT ROUTE]
                            </button>

                            <div className="premium-glass glass-edge-highlight rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden animate-in slide-in-from-bottom-12 duration-500">

                                {/* Status Indicator */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
                                    <div
                                        className="h-full bg-primary transition-all duration-1000"
                                        style={{ width: `${((currentRouteStopIndex) / activeRouteStops.length) * 100}%` }}
                                    />
                                </div>

                                <div className="flex flex-col md:flex-row gap-6 items-center">
                                    {/* Left: Client Info */}
                                    <div className="flex-1 w-full text-center md:text-left">
                                        <div className="text-[10px] font-black uppercase text-primary tracking-widest mb-2 border border-primary/30 bg-primary/10 px-2 py-0.5 rounded inline-block">
                                            TARGET {currentRouteStopIndex + 1} OF {activeRouteStops.length} // {isMowingCurrent ? 'MOWING' : 'DRIVING'}
                                        </div>
                                        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter mb-1">{currentStop.name}</h2>
                                        <p className="text-white/50 text-sm font-mono flex items-center justify-center md:justify-start gap-2">
                                            <MapPin className="w-3.5 h-3.5 text-primary opacity-70" /> {currentStop.address}
                                        </p>
                                    </div>

                                    {/* Right: Controls based on context */}
                                    <div className="w-full md:w-auto shrink-0 flex flex-col items-center">
                                        {isMowingCurrent ? (
                                            /* MOWING HUD CONTROLS */
                                            <div className="w-full">
                                                <div className="stealth-noir-glass border border-white/10 rounded-2xl p-4 text-center mb-4">
                                                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${activeSession?.status === 'break' ? 'text-orange-400' : activeSession?.status === 'stuck' ? 'text-red-400' : 'text-primary animate-pulse'}`}>
                                                        {activeSession?.status === 'break' ? 'PAUSED' : activeSession?.status === 'stuck' ? 'OBSTACLE DETECTED' : 'ENGAGED'}
                                                    </div>
                                                    <div className="text-5xl font-mono font-black text-white tracking-tighter tabular-nums drop-shadow-md">
                                                        <InlineMowTimer
                                                            startTime={activeSession?.startTime || ''}
                                                            breakTimeTotal={activeSession?.breakTimeTotal}
                                                            stuckTimeTotal={activeSession?.stuckTimeTotal}
                                                            currentBreakOrStuckStartTime={activeSession?.currentBreakOrStuckStartTime}
                                                            status={activeSession?.status || 'active'}
                                                            endTime={activeSession?.endTime || null}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-[1fr_1fr_2fr] gap-2">
                                                    <button onClick={toggleMowBreak} className={`py-4 rounded-xl flex items-center justify-center border transition-colors ${activeSession?.status === 'break' ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'glass-card hover:glass-card-hover border-white/10 text-white'}`}>
                                                        {activeSession?.status === 'break' ? <Play className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}
                                                    </button>
                                                    <button onClick={toggleMowStuck} className={`py-4 rounded-xl flex items-center justify-center border transition-colors ${activeSession?.status === 'stuck' ? 'bg-red-500/20 border-red-500/50 text-red-500' : 'glass-card hover:glass-card-hover hover:bg-red-500/20 border-white/10 hover:text-red-400 hover:border-red-500/30 text-white/50'}`}>
                                                        <AlertTriangle className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => { 
                                                            endMowSession(); 
                                                            if (activeRouteStops && currentRouteStopIndex === activeRouteStops.length - 1) {
                                                                setShowDebriefModal(true);
                                                            } else {
                                                                advanceRouteStop(); 
                                                            }
                                                        }}
                                                        className="py-4 glass-card hover:glass-card-hover border-primary/50 text-primary hover:bg-primary/20 font-black uppercase tracking-widest text-sm rounded-xl hover:scale-[1.02] shadow-[0_0_20px_rgba(204,255,0,0.1)] transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <CheckCircle2 className="w-5 h-5" /> Done
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* DRIVING HUD CONTROLS */
                                            <div className="flex flex-col gap-3 w-full md:w-64">
                                                <a
                                                    href={mapUrlForLeg} target="_blank" rel="noopener noreferrer"
                                                    className="w-full py-4 rounded-xl border border-blue-500/50 glass-card hover:glass-card-hover hover:bg-blue-500/20 text-blue-400 font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                                                >
                                                    <Navigation className="w-4 h-4" /> Nav Systems
                                                </a>
                                                <button
                                                    onClick={() => startMowSession(currentStop.clientId)}
                                                    className="w-full py-5 rounded-xl bg-primary text-black font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(204,255,0,0.3)] hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(204,255,0,0.5)] transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Zap className="w-5 h-5" /> Arrive & Engage
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* End of Day Debrief Modal */}
                    {showDebriefModal && debriefStats && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-500 pointer-events-auto px-4">
                            <div className="w-full max-w-lg p-8 rounded-3xl border border-primary/30 bg-black/50 shadow-[0_0_100px_rgba(204,255,0,0.1)]">
                                <div className="text-center mb-8">
                                    <div className="w-20 h-20 rounded-full bg-primary/20 text-primary flex items-center justify-center shadow-[0_0_30px_rgba(204,255,0,0.3)] mx-auto mb-6">
                                        <CheckCircle2 className="w-10 h-10" />
                                    </div>
                                    <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Route Complete</h2>
                                    <p className="text-white/60 text-sm font-mono">All scheduled targets have been hit.</p>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                                        <span className="text-xs font-black uppercase text-white/50 tracking-widest">Clients Mowed</span>
                                        <span className="text-2xl font-mono font-black text-white">{debriefStats.count}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                                        <span className="text-xs font-black uppercase text-white/50 tracking-widest">Total Area</span>
                                        <div className="text-right">
                                            <span className="text-2xl font-mono font-black text-white">{Math.round(debriefStats.totalSqFt).toLocaleString()}</span>
                                            <span className="text-primary text-[10px] ml-1 uppercase">sq ft</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10 border border-primary/20">
                                        <span className="text-xs font-black uppercase text-primary tracking-widest">Est. Earnings</span>
                                        <span className="text-3xl font-mono font-black text-primary">${Math.round(debriefStats.totalEarnings).toLocaleString()}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setShowDebriefModal(false);
                                        advanceRouteStop(); // this sets isFinished
                                        cancelDriveMode();
                                        if (!completedWorkdayInfo) {
                                           endWorkdaySession();
                                        }
                                    }}
                                    className="w-full py-5 rounded-xl bg-primary text-black font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(204,255,0,0.3)] hover:scale-[1.02] transition-all"
                                >
                                    Return to HQ
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── CLIENT INFO EDITING OVERLAY ─── */}
                <ClientForm 
                    initialData={editingAddressClient || undefined} 
                    open={!!editingAddressClientId} 
                    onOpenChange={(open) => {
                        if (!open) setEditingAddressClientId(null);
                    }}
                    contentClassName="sm:left-4 sm:top-24 sm:translate-x-0 sm:translate-y-0 w-[calc(100%-2rem)] sm:w-[320px] max-w-none sm:max-w-none"
                />

            </div>
        </div>
    );
}

export default function RoutePlannerPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[100dvh] bg-black">
                <div className="flex flex-col items-center gap-4">
                    <Zap className="w-12 h-12 text-primary animate-pulse" />
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-80 animate-pulse">Initializing HUD...</span>
                </div>
            </div>
        }>
            <RoutePlannerContent />
        </Suspense>
    );
}
