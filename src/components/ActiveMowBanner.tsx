/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Leaf, AlertTriangle } from "lucide-react";

export function ActiveMowBanner() {
    const { sessions, activeMowSessionId, clients, endMowSession, toggleMowBreak, toggleMowStuck } = useStore();

    const [elapsed, setElapsed] = useState(0);
    const [subElapsed, setSubElapsed] = useState(0);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const activeSession = sessions.find(s => s.id === activeMowSessionId);
    const activeClient = activeSession?.clientId ? clients.find(c => c.id === activeSession.clientId) : null;

    useEffect(() => {
        let interval: NodeJS.Timeout;

        const tick = () => {
            if (!activeSession) {
                setElapsed(0);
                setSubElapsed(0);
                return;
            }

            if (activeSession.status === 'active') {
                const start = new Date(activeSession.startTime).getTime();
                const now = new Date().getTime();
                setElapsed(
                    Math.floor((now - start) / 1000) -
                    (activeSession.breakTimeTotal || 0) -
                    (activeSession.stuckTimeTotal || 0)
                );
                setSubElapsed(0);
            } else {
                // Calculate frozen elapsed time if on break or stuck
                const start = new Date(activeSession.startTime).getTime();
                const frozenEnd = activeSession.endTime
                    ? new Date(activeSession.endTime).getTime()
                    : (activeSession.currentBreakOrStuckStartTime
                        ? new Date(activeSession.currentBreakOrStuckStartTime).getTime()
                        : new Date().getTime());
                setElapsed(
                    Math.floor((frozenEnd - start) / 1000) -
                    (activeSession.breakTimeTotal || 0) -
                    (activeSession.stuckTimeTotal || 0)
                );

                if (activeSession.currentBreakOrStuckStartTime && !activeSession.endTime) {
                    const subStart = new Date(activeSession.currentBreakOrStuckStartTime).getTime();
                    setSubElapsed(Math.floor((new Date().getTime() - subStart) / 1000));
                } else {
                    setSubElapsed(0);
                }
            }
        };

        tick();
        interval = setInterval(tick, 1000);

        return () => clearInterval(interval);
    }, [activeSession]);

    if (!isMounted || !activeSession || !activeClient) return null;

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed bottom-[90px] left-0 right-0 z-40 px-4 animate-in slide-in-from-bottom-5 fade-in duration-500">
            <div className="mx-auto max-w-md relative overflow-hidden rounded-[1.5rem] bg-card border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-2xl">
                {/* Top highlight gradient */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/80 to-transparent"></div>

                <div className="p-5 relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex flex-col items-start justify-center gap-1">
                            <div className="flex items-center text-primary font-bold tracking-wide">
                                <Leaf className="w-4 h-4 mr-2 drop-shadow-[0_0_5px_rgba(195,255,0,0.5)]" />
                                <span className="truncate max-w-[150px] text-sm md:text-base">Mowing: {activeClient.name}</span>
                            </div>
                            {activeSession.status === 'stuck' && (
                                <span className="text-[10px] uppercase text-red-500 font-bold ml-6 flex items-center gap-1.5 tracking-widest animate-pulse">
                                    <AlertTriangle className="w-3 h-3" /> Stuck for {formatTime(subElapsed)}
                                </span>
                            )}
                            {activeSession.status === 'break' && (
                                <span className="text-[10px] uppercase text-primary/70 font-bold ml-6 flex items-center gap-1.5 tracking-widest">
                                    <Pause className="w-3 h-3" /> Paused for {formatTime(subElapsed)}
                                </span>
                            )}
                        </div>
                        <div className="font-heading text-3xl font-bold tracking-tighter text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
                            {formatTime(elapsed)}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <Button
                            variant={activeSession.status === 'active' || activeSession.status === 'stuck' ? 'outline' : 'default'}
                            onClick={() => toggleMowBreak()}
                            disabled={activeSession.status === 'stuck'}
                            size="sm"
                            className={activeSession.status === 'active' || activeSession.status === 'stuck'
                                ? "h-12 rounded-xl border-primary/40 text-primary font-bold hover:bg-primary/10 hover:border-primary hover:text-primary transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                                : "h-12 rounded-xl bg-primary text-black font-bold hover:bg-primary/90 transition-all shadow-[0_4px_15px_rgba(195,255,0,0.2)]"}
                        >
                            {activeSession.status === 'break' ? <Play className="w-4 h-4 mr-1.5 fill-current" /> : <Pause className="w-4 h-4 mr-1.5 fill-current" />}
                            {activeSession.status === 'break' ? 'Resume' : 'Pause'}
                        </Button>

                        <Button
                            variant={activeSession.status === 'stuck' ? 'destructive' : 'outline'}
                            onClick={() => toggleMowStuck()}
                            disabled={activeSession.status === 'break'}
                            size="sm"
                            className={activeSession.status === 'stuck'
                                ? "h-12 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 border-none transition-all shadow-[0_4px_15px_rgba(239,68,68,0.3)]"
                                : "h-12 rounded-xl border-red-500/40 text-red-500 font-bold hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"}
                        >
                            {activeSession.status === 'stuck' ? <Play className="w-4 h-4 mr-1.5 fill-current" /> : <AlertTriangle className="w-4 h-4 mr-1.5 stroke-[2.5]" />}
                            {activeSession.status === 'stuck' ? 'Unstuck' : 'Stuck'}
                        </Button>

                        <Button
                            onClick={() => endMowSession()}
                            size="sm"
                            variant="default"
                            className="h-12 rounded-xl bg-white hover:bg-white/90 text-black font-bold border border-white/10 shadow-[0_4px_20px_rgba(255,255,255,0.2)] transition-all"
                        >
                            <Square className="w-4 h-4 mr-1.5 fill-current" /> Complete
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
