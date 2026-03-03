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
        <div className="fixed bottom-[80px] left-0 right-0 z-40 px-4 animate-in slide-in-from-bottom-2 fade-in duration-300">
            <div className="mx-auto max-w-md relative overflow-hidden rounded-2xl glass-card border border-primary/40 bg-[#0a150c]/80 backdrop-blur-xl shadow-lg shadow-primary/10">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-70"></div>
                <div className="p-4 relative z-10">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex flex-col items-start justify-center">
                            <div className="flex items-center text-primary font-bold">
                                <Leaf className="w-4 h-4 mr-2" />
                                <span className="truncate max-w-[150px]">Mowing: {activeClient.name}</span>
                            </div>
                            {activeSession.status === 'stuck' && (
                                <span className="text-xs text-red-500 font-bold ml-6 flex items-center gap-1 animate-pulse">
                                    <AlertTriangle className="w-3 h-3" /> Stuck for {formatTime(subElapsed)}
                                </span>
                            )}
                            {activeSession.status === 'break' && (
                                <span className="text-xs text-primary/70 font-bold ml-6 flex items-center gap-1">
                                    <Pause className="w-3 h-3" /> Paused for {formatTime(subElapsed)}
                                </span>
                            )}
                        </div>
                        <div className="font-mono text-xl font-bold tracking-tight text-white drop-shadow-[0_0_8px_rgba(170,255,0,0.5)]">
                            {formatTime(elapsed)}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <Button
                            variant={activeSession.status === 'active' || activeSession.status === 'stuck' ? 'outline' : 'default'}
                            onClick={() => toggleMowBreak()}
                            disabled={activeSession.status === 'stuck'}
                            size="sm"
                            className={activeSession.status === 'active' || activeSession.status === 'stuck'
                                ? "border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"}
                        >
                            {activeSession.status === 'break' ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
                            {activeSession.status === 'break' ? 'Resume' : 'Pause'}
                        </Button>
                        <Button
                            variant={activeSession.status === 'stuck' ? 'destructive' : 'outline'}
                            onClick={() => toggleMowStuck()}
                            disabled={activeSession.status === 'break'}
                            size="sm"
                            className={activeSession.status === 'stuck'
                                ? "bg-red-500 text-white hover:bg-red-600 border-none"
                                : "border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-500"}
                        >
                            {activeSession.status === 'stuck' ? <Play className="w-4 h-4 mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
                            {activeSession.status === 'stuck' ? 'Unstuck' : 'Stuck'}
                        </Button>
                        <Button
                            onClick={() => endMowSession()}
                            size="sm"
                            variant="default"
                            className="bg-white hover:bg-white/90 text-black font-bold border border-white/10 shadow-[0_4px_15px_rgba(255,255,255,0.2)]"
                        >
                            <Square className="w-4 h-4 mr-1" /> Complete
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
