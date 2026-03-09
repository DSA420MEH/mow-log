"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
    MapPin, Navigation, Home, Route as RouteIcon, ExternalLink,
    Fuel, ArrowLeft, Zap, GripVertical, PauseCircle, Play,
    AlertTriangle, CheckCircle2, Image as ImageIcon, Clock
} from "lucide-react";
import { useStore } from "@/lib/store";
import { optimizeRoute, recalculateRoute, type OptimizedRoute } from "@/lib/route-optimizer";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";

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


function RoutePlannerContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initClientId = searchParams.get("initClient");

    const {
        clients, homeAddress, homeLat, homeLng, setHomeAddress, fuelCostPerKm,
        activeRouteStops, currentRouteStopIndex, startDriveMode, advanceRouteStop, cancelDriveMode,
        startMowSession, endMowSession, toggleMowBreak, toggleMowStuck, sessions, activeMowSessionId,
        activeWorkdaySessionId, startWorkdaySession, endWorkdaySession, toggleWorkdayBreak
    } = useStore();

    const clientsWithCoords = clients.filter(c => c.lat && c.lng);

    const initClient = useMemo(() =>
        clients.find(c => c.id === initClientId),
        [clients, initClientId]
    );

    const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
    const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
    const [homeInput, setHomeInput] = useState(homeAddress || "");
    const [settingHome, setSettingHome] = useState(false);

    const [completedWorkdayId, setCompletedWorkdayId] = useState<string | null>(null);

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
        setSelectedClientIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
        setOptimizedRoute(null);
    };

    const selectAll = () => {
        setSelectedClientIds(new Set(clientsWithCoords.map(c => c.id)));
        setOptimizedRoute(null);
    };

    const clearAll = () => {
        setSelectedClientIds(new Set());
        setOptimizedRoute(null);
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
        setOptimizedRoute(result);
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || !optimizedRoute || !homeLat || !homeLng) return;

        const items = Array.from(optimizedRoute.stops);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        const newRoute = recalculateRoute(homeLat, homeLng, items, fuelCostPerKm);
        setOptimizedRoute(newRoute);
    };

    const geocodeHome = useCallback(async () => {
        if (!homeInput.trim()) return;
        setSettingHome(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(homeInput)}&format=json&limit=1`
            );
            const data = await res.json();
            if (data.length > 0) {
                setHomeAddress(homeInput, parseFloat(data[0].lat), parseFloat(data[0].lon));
            }
        } catch (err) {
            console.error("Geocoding failed:", err);
        }
        setSettingHome(false);
    }, [homeInput, setHomeAddress]);

    return (
        <div className="relative w-full h-[100dvh] overflow-hidden bg-black text-foreground font-sans">
            {/* 1. Map Background (Z: 0) */}
            <UnifiedGameMap />

            {/* 2. HUD Overlays (Z: 10) */}
            <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between">

                {/* ─── TOP HUD ─── */}
                <header className="w-full flex justify-between items-start p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-auto">
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
                        <div className="bg-black/60 backdrop-blur-md border border-primary/30 rounded-xl p-3 shadow-[0_0_20px_rgba(204,255,0,0.1)] flex items-center gap-4">
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
                                className={`px-4 py-2 border rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${activeWorkday.status === 'break' ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-white/10 text-white hover:bg-white/20 border-white/20'}`}
                            >
                                {activeWorkday.status === 'break' ? 'Resume' : 'Pause'}
                            </button>
                        </div>
                    )}
                </header>


                {/* ─── MIDDLE HUD (SIDEBAR) ─── */}
                <div className="flex-1 w-full px-4 overflow-hidden flex items-stretch pointer-events-none">

                    {/* PLANNER SIDEBAR (Only show when NOT driving) */}
                    {!isDrivingActive && !completedWorkdayInfo && !isFinished && (
                        <div className="w-80 h-full flex flex-col pointer-events-auto bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl relative animate-in slide-in-from-left-8 duration-500 overflow-hidden">

                            {/* Decorative Top Accent */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

                            <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                                <h2 className="text-sm font-black uppercase tracking-widest text-white/80 flex items-center gap-2">
                                    <RouteIcon className="w-4 h-4 text-primary" /> Route Control
                                </h2>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                                {/* Base Setup */}
                                <div>
                                    <label className="text-[10px] uppercase text-muted-foreground tracking-widest font-bold mb-2 flex items-center gap-1">
                                        <Home className="w-3 h-3" /> Base Location
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="HQ Address..."
                                            value={homeInput}
                                            onChange={(e) => setHomeInput(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && geocodeHome()}
                                            className="flex-1 px-3 py-2 rounded-lg bg-black/50 border border-white/20 text-white text-xs font-mono focus:border-primary focus:outline-none transition-colors"
                                        />
                                        <button
                                            onClick={geocodeHome}
                                            disabled={settingHome}
                                            className="px-3 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-xs font-bold disabled:opacity-50 transition-colors"
                                        >
                                            {settingHome ? "..." : homeLat ? "Set" : "Set"}
                                        </button>
                                    </div>
                                    {homeLat && homeLng && (
                                        <p className="text-[9px] text-primary/70 font-mono mt-1 opacity-70">Loc: {homeLat.toFixed(4)}, {homeLng.toFixed(4)}</p>
                                    )}
                                </div>

                                {/* Target Selection */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] uppercase text-muted-foreground tracking-widest font-bold">
                                            Targets ({clientsWithCoords.length})
                                        </label>
                                        <div className="flex gap-1">
                                            <button onClick={selectAll} className="text-[9px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors uppercase font-bold tracking-wider">All</button>
                                            <button onClick={clearAll} className="text-[9px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors uppercase font-bold tracking-wider">Clr</button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-1">
                                        {clientsWithCoords.map(client => (
                                            <button
                                                key={client.id}
                                                onClick={() => toggleClient(client.id)}
                                                className={`w-full px-3 py-2.5 rounded-lg text-left text-xs flex items-center justify-between transition-all border ${selectedClientIds.has(client.id)
                                                    ? "bg-primary/10 border-primary/30 text-primary"
                                                    : "bg-black/40 border-white/5 text-white/60 hover:bg-white/5"
                                                    }`}
                                            >
                                                <span className="font-bold truncate pr-2">{client.name}</span>
                                                <div className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${selectedClientIds.has(client.id) ? "border-primary bg-primary text-black" : "border-white/30"}`}>
                                                    {selectedClientIds.has(client.id) && <CheckCircle2 className="w-2.5 h-2.5" />}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Generate */}
                                <button
                                    onClick={generateDailyRoute}
                                    disabled={!homeLat || selectedClientIds.size === 0}
                                    className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${homeLat && selectedClientIds.size > 0
                                        ? "bg-white text-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                                        : "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
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
                                                                        className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all border ${snapshot.isDragging ? "bg-primary/20 border-primary shadow-xl z-50 backdrop-blur-md" : "bg-black/40 border-white/5 hover:bg-white/5"
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
                        </div>
                    )}
                </div>


                {/* ─── BOTTOM HUD (DRIVE / MOW OVERLAYS) ─── */}
                <div className="w-full px-4 pb-8 pt-20 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none flex flex-col items-center justify-end">

                    {/* Shift Complete State */}
                    {completedWorkdayInfo && (
                        <div className="pointer-events-auto bg-black border border-white/10 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-700">
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
                                className="w-full py-4 rounded-xl font-black uppercase tracking-widest bg-white text-black hover:scale-105 transition-transform"
                            >
                                Return to Command Center
                            </button>
                        </div>
                    )}

                    {/* Returning Home State */}
                    {isFinished && !completedWorkdayInfo && (
                        <div className="pointer-events-auto bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
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

                            <div className="bg-black/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden animate-in slide-in-from-bottom-12 duration-500">

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
                                                <div className="bg-black/50 border border-white/5 rounded-2xl p-4 text-center mb-4">
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
                                                    <button onClick={toggleMowBreak} className={`py-4 rounded-xl flex items-center justify-center border transition-colors ${activeSession?.status === 'break' ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'}`}>
                                                        {activeSession?.status === 'break' ? <Play className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}
                                                    </button>
                                                    <button onClick={toggleMowStuck} className={`py-4 rounded-xl flex items-center justify-center border transition-colors ${activeSession?.status === 'stuck' ? 'bg-red-500/20 border-red-500/50 text-red-500' : 'bg-white/5 border-white/10 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 text-white/50'}`}>
                                                        <AlertTriangle className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => { endMowSession(); advanceRouteStop(); }}
                                                        className="py-4 bg-primary text-black font-black uppercase tracking-widest text-sm rounded-xl hover:scale-[1.02] shadow-[0_0_20px_rgba(204,255,0,0.2)] transition-all flex items-center justify-center gap-2"
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
                                                    className="w-full py-4 rounded-xl border border-blue-500/50 bg-blue-500/10 text-blue-400 font-bold uppercase tracking-widest text-[11px] hover:bg-blue-500/20 flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                </div>

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
