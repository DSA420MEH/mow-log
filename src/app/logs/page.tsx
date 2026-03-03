/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { useStore, type Equipment } from "@/lib/store";
import { computeDailyProfit, computeEquipmentAlerts } from "@/lib/selectors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Fuel, Wrench, Play, Square, Pause, Plus, Scan, Trash2, DollarSign, Settings2, CheckCircle2, AlertTriangle, Leaf, Scissors, Droplets } from "lucide-react";
import { useMemo } from "react";
import { LawnEventForms } from "@/components/LawnEventForms";

// Daily profit summary component
function DailyProfitCard() {
    const today = new Date().toISOString().slice(0, 10);
    const { clients, sessions, gasLogs, maintenanceLogs } = useStore();
    const daily = useMemo(() => computeDailyProfit(today), [today, clients, sessions, gasLogs, maintenanceLogs]);

    if (daily.sessionsCount === 0 && daily.gasCost === 0) return null;

    const isPositive = daily.profit >= 0;
    const fmt = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);

    return (
        <Card className="border-white/10 bg-card rounded-[1.5rem] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] animate-in fade-in slide-in-from-bottom-3 duration-500 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
            <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold">Today&apos;s Summary</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-3 rounded-2xl bg-[#0a0f0d] border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Revenue</p>
                        <p className="text-base font-heading font-black tracking-tight text-white">{fmt(daily.revenue)}</p>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-[#0a0f0d] border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Gas</p>
                        <p className="text-base font-heading font-black tracking-tight text-orange-400">{fmt(daily.gasCost)}</p>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-[#0a0f0d] border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Maint.</p>
                        <p className="text-base font-heading font-black tracking-tight text-red-400">{fmt(daily.maintCost)}</p>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-[#0a0f0d] border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Profit</p>
                        <p className={`text-base font-heading font-black tracking-tight ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt(daily.profit)}
                        </p>
                    </div>
                </div>
                <p className="text-[10px] text-white/40 mt-3 text-center uppercase tracking-widest font-bold">
                    {daily.sessionsCount} session{daily.sessionsCount !== 1 ? 's' : ''} completed today
                </p>
            </CardContent>
        </Card>
    );
}

export default function LogsPage() {
    const {
        sessions, activeWorkdaySessionId, gasLogs, maintenanceLogs,
        mowingEvents, wateringEvents, fertilizingEvents,
        startWorkdaySession, endWorkdaySession, toggleWorkdayBreak, addGasLog, addMaintenanceLog
    } = useStore();

    // Combine and sort events
    const recentLawnEvents = useMemo(() => {
        const combined = [...mowingEvents, ...wateringEvents, ...fertilizingEvents];
        return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
    }, [mowingEvents, wateringEvents, fertilizingEvents]);

    const activeSession = sessions.find(s => s.id === activeWorkdaySessionId);

    // Timer State
    const [elapsed, setElapsed] = useState(0);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (activeSession && activeSession.status === 'active') {
            interval = setInterval(() => {
                const start = new Date(activeSession.startTime).getTime();
                const now = new Date().getTime();
                setElapsed(Math.floor((now - start) / 1000) - activeSession.breakTimeTotal);
            }, 1000);
        } else if (activeSession) {
            // Calculate frozen elapsed time if on break or completed
            const start = new Date(activeSession.startTime).getTime();
            const end = activeSession.endTime ? new Date(activeSession.endTime).getTime() : new Date().getTime();
            setElapsed(Math.floor((end - start) / 1000) - activeSession.breakTimeTotal);
        } else {
            setElapsed(0);
        }
        return () => clearInterval(interval);
    }, [activeSession]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Gas modal state
    const [gasOpen, setGasOpen] = useState(false);
    const [liters, setLiters] = useState("");
    const [pricePerLiter, setPricePerLiter] = useState("");

    const handleGasSave = () => {
        const l = parseFloat(liters);
        const p = parseFloat(pricePerLiter);
        if (!isNaN(l) && !isNaN(p)) {
            addGasLog({ liters: l, pricePerLiter: p, total: l * p, isAiScanned: false });
            setGasOpen(false);
            setLiters(""); setPricePerLiter("");
        }
    };

    // Maintenance modal state
    const [maintOpen, setMaintOpen] = useState(false);
    const [mDescription, setMDescription] = useState("");
    const [mParts, setMParts] = useState<{ name: string, cost: string }[]>([{ name: "", cost: "" }]);

    const handleMaintSave = () => {
        const validParts = mParts.filter(p => p.name && parseFloat(p.cost) >= 0).map(p => ({
            id: crypto.randomUUID(), name: p.name, cost: parseFloat(p.cost)
        }));
        if (mDescription && validParts.length > 0) {
            addMaintenanceLog({ description: mDescription, parts: validParts });
            setMaintOpen(false);
            setMDescription("");
            setMParts([{ name: "", cost: "" }]);
        }
    };

    if (!isMounted) return null;

    return (
        <main className="p-4 pb-32 min-h-screen space-y-6">
            <div className="pt-6 mb-4 animate-in fade-in slide-in-from-bottom-1">
                <h1 className="text-4xl font-heading font-black tracking-tighter text-white mb-2">
                    <span className="text-primary drop-shadow-[0_0_15px_rgba(195,255,0,0.3)]">Operational</span> Logs
                </h1>
                <p className="text-white/50 text-xs font-medium uppercase tracking-[0.2em]">Track time, fuel, and repairs.</p>
            </div>

            {/* WORK TIMER CARD */}
            <Card className="border-white/10 bg-card shadow-[0_10px_40px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-[1.5rem] overflow-hidden relative animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
                <div className={`absolute top-0 left-0 w-full h-1 ${activeSession?.status === 'active' ? 'bg-primary' : 'bg-white/20'}`}></div>
                <CardHeader className="pb-4 pt-6 px-6">
                    <CardTitle className="text-[10px] text-white/50 font-bold uppercase tracking-[0.2em] flex items-center justify-between">
                        <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Mowing Session</span>
                        {activeSession && <Badge variant={activeSession.status === 'active' ? 'default' : 'secondary'} className={`${activeSession.status === 'active' ? 'bg-primary/20 text-primary border-primary/30 shadow-[0_0_10px_rgba(195,255,0,0.2)] animate-pulse' : 'bg-white/5 text-white/40 border-white/10'} text-[9px] uppercase tracking-widest rounded-full px-2 py-0.5`}>
                            {activeSession.status}
                        </Badge>}
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                    {!activeSession ? (
                        <div className="text-center py-8">
                            <p className="text-white/40 text-sm mb-6 font-medium">No active session.</p>
                            <Button onClick={() => startWorkdaySession()} className="w-full bg-primary hover:bg-primary/90 text-black font-bold h-14 rounded-2xl shadow-[0_5px_15px_rgba(195,255,0,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]">
                                <Play className="w-5 h-5 mr-2" /> Start General Clock-In
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-2">
                                    General Work
                                </p>
                                <div className="text-7xl font-heading font-black tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                                    {formatTime(elapsed)}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    onClick={() => toggleWorkdayBreak()}
                                    className={`h-12 rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${activeSession.status === 'active' ? "bg-white/5 hover:bg-white/10 text-white border border-white/10" : "bg-primary text-black shadow-[0_5px_15px_rgba(195,255,0,0.3)]"}`}
                                >
                                    {activeSession.status === 'active' ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                    {activeSession.status === 'active' ? 'Pause' : 'Resume'}
                                </Button>
                                <Button onClick={() => endWorkdaySession()} className="h-12 rounded-2xl font-bold bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                                    <Square className="w-4 h-4 mr-2" /> End
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* DAILY PROFIT SUMMARY */}
            <DailyProfitCard />

            {/* LAWN EVENTS SECTION */}
            <Card className="border-white/10 bg-card rounded-[1.5rem] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150">
                <CardHeader className="pb-4 pt-5 px-5 border-b border-white/5 bg-white/[0.02]">
                    <CardTitle className="text-[10px] text-white/50 font-bold uppercase tracking-[0.2em] flex items-center justify-between">
                        <span className="flex items-center gap-2"><Leaf className="w-4 h-4 text-emerald-500" /> Lawn Events</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-5 pt-5 pb-5">

                    {recentLawnEvents.length > 0 ? (
                        <div className="space-y-3">
                            {recentLawnEvents.map(event => {
                                const isMow = event.type === 'mow';
                                const isWater = event.type === 'water';
                                return (
                                    <div key={event.id} className="flex justify-between items-start p-4 rounded-2xl bg-[#0a0f0d] border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                {isMow ? <Scissors className="w-3.5 h-3.5 text-primary" /> : isWater ? <Droplets className="w-3.5 h-3.5 text-blue-400" /> : <Leaf className="w-3.5 h-3.5 text-emerald-400" />}
                                                <p className="font-bold text-white text-sm capitalize">{event.type} Event</p>
                                            </div>
                                            <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest mt-0.5 max-w-[200px] truncate">
                                                {isMow && `${(event as any).cutHeightInches}" Cut | ${(event as any).grassBagged ? 'Bagged' : 'Mulched'}`}
                                                {isWater && `${(event as any).durationMinutes} mins | ${(event as any).waterAmountInches || '?'} inches`}
                                                {!isMow && !isWater && `${(event as any).productName} | ${(event as any).npkRatio}`}
                                            </p>
                                        </div>
                                        <p className="font-bold text-xs text-white/50">{new Date(event.date).toLocaleDateString()}</p>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-6 border border-dashed border-white/10 rounded-2xl bg-[#0a0f0d]">
                            <p className="text-xs text-white/40 font-medium">No lawn events logged yet.</p>
                        </div>
                    )}

                    <LawnEventForms />
                </CardContent>
            </Card>

            {/* GAS LOG CARD */}
            <Card className="border-white/10 bg-card rounded-[1.5rem] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                <CardHeader className="pb-4 pt-5 px-5 border-b border-white/5 bg-white/[0.02]">
                    <CardTitle className="text-[10px] text-white/50 font-bold uppercase tracking-[0.2em] flex items-center justify-between">
                        <span className="flex items-center gap-2"><Fuel className="w-4 h-4 text-primary" /> Fuel Log</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 px-5 pt-5 pb-5">
                    <div className="grid grid-cols-2 gap-3">
                        <Dialog open={gasOpen} onOpenChange={setGasOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full h-12 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold">
                                    <Plus className="w-4 h-4 mr-2" /> Manual
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-2xl border-white/10 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-6">
                                <DialogTitle className="text-xl font-heading font-black text-white">Log Fuel Manual</DialogTitle>
                                {/* @ts-ignore - WebMCP experimental attributes */}
                                <form
                                    className="space-y-5 pt-4"
                                    tool-name="log_gas_expense_html"
                                    tool-description="Submit a manual fuel log entry for the mowing equipment by providing liters and price per liter."
                                    tool-autosubmit="true"
                                    onSubmit={(e) => { e.preventDefault(); handleGasSave(); }}
                                >
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Liters (L)</Label>
                                            <Input name="liters" type="number" value={liters} onChange={e => setLiters(e.target.value)} className="bg-[#0a0f0d] border-white/10 h-14 rounded-xl text-lg font-bold" placeholder="0.00" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Price per L ($)</Label>
                                            <Input name="pricePerLiter" type="number" value={pricePerLiter} onChange={e => setPricePerLiter(e.target.value)} className="bg-[#0a0f0d] border-white/10 h-14 rounded-xl text-lg font-bold" placeholder="1.50" />
                                        </div>
                                    </div>
                                    <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 flex justify-between items-center shadow-[inset_0_1px_1px_rgba(195,255,0,0.1)]">
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-primary/80">Estimated</span>
                                        <span className="font-heading font-black text-3xl text-primary">${((parseFloat(liters) || 0) * (parseFloat(pricePerLiter) || 0)).toFixed(2)}</span>
                                    </div>
                                    <Button type="submit" className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-black font-bold text-base shadow-[0_5px_15px_rgba(195,255,0,0.3)]">Save Gas Log</Button>
                                </form>
                            </DialogContent>
                        </Dialog>

                        <Button className="w-full h-12 rounded-xl bg-white text-black font-bold hover:bg-white/90">
                            <Scan className="w-4 h-4 mr-2" /> Scan Pump
                        </Button>
                    </div>

                    {gasLogs.length > 0 && (
                        <div className="space-y-3 mt-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {gasLogs.slice().reverse().slice(0, 3).map(log => (
                                <div key={log.id} className="flex justify-between items-center p-4 rounded-2xl bg-[#0a0f0d] border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                                    <div>
                                        <p className="font-bold text-white text-sm">{new Date(log.date).toLocaleDateString()}</p>
                                        <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest mt-0.5">{log.liters.toFixed(2)}L @ ${log.pricePerLiter.toFixed(2)}/L</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-heading font-black text-lg text-primary">${log.total.toFixed(2)}</p>
                                        {log.isAiScanned && <Badge className="text-[8px] uppercase tracking-widest px-1.5 py-0 mt-1 bg-primary/20 text-primary border border-primary/30">AI</Badge>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* MAINTENANCE LOG CARD */}
            <Card className="border-white/10 bg-card rounded-[1.5rem] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] animate-in fade-in slide-in-from-bottom-5 duration-500 delay-300">
                <CardHeader className="pb-4 pt-5 px-5 border-b border-white/5 bg-white/[0.02]">
                    <CardTitle className="text-[10px] text-white/50 font-bold uppercase tracking-[0.2em] flex items-center justify-between">
                        <span className="flex items-center gap-2"><Wrench className="w-4 h-4 text-primary" /> Repairs & Maint.</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-5">
                    <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 font-bold transition-all">
                                <Plus className="w-4 h-4 mr-2" /> Log Maintenance
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-2xl border-white/10 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                            <DialogTitle className="text-xl font-heading font-black text-white">Log Maintenance</DialogTitle>
                            <div className="space-y-6 pt-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Description / Issue</Label>
                                    <Input value={mDescription} onChange={e => setMDescription(e.target.value)} className="bg-[#0a0f0d] border-white/10 h-14 rounded-xl text-sm" placeholder="Changed mower blades" />
                                </div>

                                <div className="space-y-3 pt-4 border-t border-white/10">
                                    <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Parts Replaced & Costs</Label>
                                    {mParts.map((part, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <Input value={part.name} onChange={e => {
                                                const newParts = [...mParts];
                                                newParts[index].name = e.target.value;
                                                setMParts(newParts);
                                            }} className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl text-sm flex-[2]" placeholder="Blade set" />
                                            <Input type="number" value={part.cost} onChange={e => {
                                                const newParts = [...mParts];
                                                newParts[index].cost = e.target.value;
                                                setMParts(newParts);
                                            }} className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl text-sm flex-[1]" placeholder="$0.00" />
                                            <Button variant="ghost" size="icon" onClick={() => {
                                                if (mParts.length > 1) {
                                                    setMParts(mParts.filter((_, i) => i !== index));
                                                }
                                            }} className="text-white/30 hover:text-red-400 shrink-0 h-12 w-12 rounded-xl bg-[#0a0f0d] border border-white/5">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button variant="ghost" size="sm" onClick={() => setMParts([...mParts, { name: "", cost: "" }])} className="text-primary hover:text-primary/80 mt-2 text-xs font-bold w-full h-10 border border-dashed border-primary/30 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors">
                                        <Plus className="w-3 h-3 mr-2" /> Add Part
                                    </Button>
                                </div>

                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex justify-between items-center mt-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">Total</span>
                                    <span className="font-heading font-black text-3xl text-white">
                                        ${mParts.reduce((acc, p) => acc + (parseFloat(p.cost) || 0), 0).toFixed(2)}
                                    </span>
                                </div>
                                <Button onClick={handleMaintSave} className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-black font-bold text-base shadow-[0_5px_15px_rgba(195,255,0,0.3)]">Save Maintenance</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {maintenanceLogs.length > 0 && (
                        <div className="space-y-3 mt-5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {maintenanceLogs.slice().reverse().slice(0, 3).map(log => (
                                <div key={log.id} className="p-4 rounded-2xl bg-[#0a0f0d] border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-bold text-white text-sm line-clamp-1 flex-1 pr-3">{log.description}</p>
                                        <p className="font-heading font-black text-lg text-primary shrink-0">${log.totalCost.toFixed(2)}</p>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-medium text-white/40 uppercase tracking-widest border-t border-white/5 pt-2">
                                        <span>{new Date(log.date).toLocaleDateString()}</span>
                                        <span>{log.parts.length} part{log.parts.length !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* EQUIPMENT TRACKER */}
            <EquipmentSection />
        </main>
    );
}

function EquipmentSection() {
    const { equipment, addEquipment, markServiceDone, deleteEquipment } = useStore();
    const alerts = useMemo(() => computeEquipmentAlerts(), [equipment]);
    const [eqOpen, setEqOpen] = useState(false);
    const [eqName, setEqName] = useState("");
    const [eqType, setEqType] = useState<Equipment['type']>('mower');
    const [serviceItems, setServiceItems] = useState<{ name: string; hours: string }[]>([
        { name: "Blade Sharpening", hours: "25" },
        { name: "Oil Change", hours: "50" },
    ]);

    const handleAddEquipment = () => {
        if (!eqName.trim()) return;
        addEquipment({
            name: eqName,
            type: eqType,
            serviceIntervals: serviceItems
                .filter(s => s.name && parseFloat(s.hours) > 0)
                .map(s => ({
                    id: crypto.randomUUID(),
                    name: s.name,
                    intervalHours: parseFloat(s.hours),
                    lastServiceHours: 0,
                    lastServiceDate: new Date().toISOString(),
                })),
        });
        setEqOpen(false);
        setEqName("");
        setEqType('mower');
        setServiceItems([{ name: "Blade Sharpening", hours: "25" }, { name: "Oil Change", hours: "50" }]);
    };

    return (
        <Card className="border-white/10 bg-card rounded-[1.5rem] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] animate-in fade-in slide-in-from-bottom-6 duration-500 delay-500">
            <CardHeader className="pb-4 pt-5 px-5 border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-[10px] text-white/50 font-bold uppercase tracking-[0.2em] flex items-center justify-between">
                    <span className="flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary" /> Equipment Tracker</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-5">
                <Dialog open={eqOpen} onOpenChange={setEqOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full h-12 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold mb-5 transition-all">
                            <Plus className="w-4 h-4 mr-2" /> Add Equipment
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-2xl border-white/10 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                        <DialogTitle className="text-xl font-heading font-black text-white">Add Equipment</DialogTitle>
                        <div className="space-y-5 pt-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Equipment Name</Label>
                                <Input value={eqName} onChange={e => setEqName(e.target.value)} className="bg-[#0a0f0d] border-white/10 h-14 rounded-xl text-sm" placeholder="Honda HRX217" />
                            </div>
                            <div className="space-y-3">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Type</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['mower', 'trimmer', 'blower', 'other'] as const).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setEqType(t)}
                                            className={`h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${eqType === t ? 'bg-primary text-black shadow-[0_2px_10px_rgba(195,255,0,0.3)]' : 'bg-[#0a0f0d] border border-white/5 text-white/50 hover:bg-white/5 hover:text-white'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3 pt-4 border-t border-white/10">
                                <Label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Service Intervals</Label>
                                {serviceItems.map((item, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <Input value={item.name} onChange={e => { const u = [...serviceItems]; u[i].name = e.target.value; setServiceItems(u); }} className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl text-sm flex-[2]" placeholder="Service name" />
                                        <Input type="number" value={item.hours} onChange={e => { const u = [...serviceItems]; u[i].hours = e.target.value; setServiceItems(u); }} className="bg-[#0a0f0d] border-white/10 h-12 rounded-xl text-sm flex-[1]" placeholder="Hours" />
                                        <span className="text-[10px] font-bold text-white/40 uppercase">hrs</span>
                                        <Button variant="ghost" size="icon" onClick={() => { if (serviceItems.length > 1) setServiceItems(serviceItems.filter((_, idx) => idx !== i)); }} className="text-white/30 hover:text-red-400 shrink-0 h-12 w-12 rounded-xl bg-[#0a0f0d] border border-white/5">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="ghost" size="sm" onClick={() => setServiceItems([...serviceItems, { name: "", hours: "" }])} className="text-primary hover:text-primary/80 mt-2 text-xs font-bold w-full h-10 border border-dashed border-primary/30 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors">
                                    <Plus className="w-3 h-3 mr-2" /> Add Interval
                                </Button>
                            </div>
                            <Button onClick={handleAddEquipment} className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-black font-bold text-base shadow-[0_5px_15px_rgba(195,255,0,0.3)] mt-2">Save Equipment</Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {equipment.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center px-4 bg-[#0a0f0d] rounded-2xl border border-white/5 border-dashed">
                        <Settings2 className="w-8 h-8 text-white/20 mb-3" />
                        <p className="text-sm text-white/60 font-medium">No equipment tracked.</p>
                        <p className="text-xs text-white/40 mt-1">Add your mower to monitor service intervals.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {equipment.map(eq => (
                            <div key={eq.id} className="p-4 rounded-2xl bg-[#0a0f0d] border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                    <div>
                                        <p className="font-bold text-base text-white">{eq.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[9px] uppercase tracking-widest px-1.5 py-0 bg-white/5 border-white/10 text-white/60">{eq.type}</Badge>
                                            <span className="text-xs text-white/40 font-medium">&middot; {eq.currentHours.toFixed(1)} hrs</span>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => deleteEquipment(eq.id)} className="text-white/30 hover:text-red-400 h-8 w-8 rounded-lg">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    {eq.serviceIntervals.map(si => {
                                        const hoursSince = eq.currentHours - si.lastServiceHours;
                                        const progress = Math.min((hoursSince / si.intervalHours) * 100, 100);
                                        const isOverdue = hoursSince >= si.intervalHours;
                                        const isWarning = progress >= 75;
                                        return (
                                            <div key={si.id} className="flex items-center gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-[11px] font-bold text-white/70 truncate uppercase tracking-wider">{si.name}</span>
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isOverdue ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                            {hoursSince.toFixed(1)}h / {si.intervalHours}h
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                                                        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${isOverdue ? 'bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : isWarning ? 'bg-gradient-to-r from-orange-500 to-orange-400' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'}`} style={{ width: `${progress}%` }} />
                                                    </div>
                                                </div>
                                                <button onClick={() => markServiceDone(eq.id, si.id)} className={`shrink-0 h-10 w-10 flex items-center justify-center rounded-xl transition-all ${isOverdue || isWarning ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary text-black' : 'bg-white/5 text-white/30 border border-white/10 hover:text-white hover:bg-white/10'}`} title="Mark as serviced">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
