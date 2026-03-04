"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useStore, type Equipment } from "@/lib/store";
import { computeDailyProfit } from "@/lib/selectors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Fuel, Wrench, Play, Square, Pause, Plus, Scan, Trash2, DollarSign, Settings2, CheckCircle2 } from "lucide-react";

// Daily profit summary component
function DailyProfitCard() {
    const today = new Date().toISOString().slice(0, 10);
    const daily = computeDailyProfit(today);

    if (daily.sessionsCount === 0 && daily.gasCost === 0) return null;

    const isPositive = daily.profit >= 0;
    const fmt = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);

    return (
        <Card className="glass-card border-white/10 bg-white/[0.02]">
            <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Today&apos;s Summary</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                        <p className="text-[10px] text-muted-foreground uppercase">Revenue</p>
                        <p className="text-sm font-bold text-primary">{fmt(daily.revenue)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                        <p className="text-[10px] text-muted-foreground uppercase">Gas</p>
                        <p className="text-sm font-bold text-orange-400">{fmt(daily.gasCost)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                        <p className="text-[10px] text-muted-foreground uppercase">Maint.</p>
                        <p className="text-sm font-bold text-red-400">{fmt(daily.maintCost)}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                        <p className="text-[10px] text-muted-foreground uppercase">Profit</p>
                        <p className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt(daily.profit)}
                        </p>
                    </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    {daily.sessionsCount} session{daily.sessionsCount !== 1 ? 's' : ''} completed today
                </p>
            </CardContent>
        </Card>
    );
}

export default function LogsPage() {
    const {
        sessions, activeWorkdaySessionId, gasLogs, maintenanceLogs,
        startWorkdaySession, endWorkdaySession, toggleWorkdayBreak, addGasLog, addMaintenanceLog
    } = useStore();

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
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [scanStatus, setScanStatus] = useState<string | null>(null);
    const scanFileInputRef = useRef<HTMLInputElement>(null);

    const handleGasSave = () => {
        const l = parseFloat(liters);
        const p = parseFloat(pricePerLiter);
        if (!isNaN(l) && !isNaN(p)) {
            addGasLog({ liters: l, pricePerLiter: p, total: l * p, isAiScanned: false });
            setGasOpen(false);
            setLiters(""); setPricePerLiter("");
        }
    };

    const readImageAsBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result !== "string") {
                    reject(new Error("Could not read selected image."));
                    return;
                }
                const [, imageBase64] = reader.result.split(",");
                if (!imageBase64) {
                    reject(new Error("Invalid image data."));
                    return;
                }
                resolve(imageBase64);
            };
            reader.onerror = () => reject(new Error("Failed to read image file."));
            reader.readAsDataURL(file);
        });

    const handleScanClick = () => {
        setScanError(null);
        setScanStatus(null);
        scanFileInputRef.current?.click();
    };

    const handleScanFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setScanError("Please select an image file.");
            return;
        }

        setIsScanning(true);
        setScanError(null);
        setScanStatus(null);

        try {
            const imageBase64 = await readImageAsBase64(file);
            const response = await fetch("/api/scan-pump", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageBase64 }),
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(
                    typeof payload?.error === "string"
                        ? payload.error
                        : "Failed to scan pump display."
                );
            }

            const litersValue = Number(payload?.liters);
            const pricePerLiterValue = Number(payload?.pricePerLiter);
            const totalValue = Number(payload?.total);

            if (
                !Number.isFinite(litersValue) ||
                !Number.isFinite(pricePerLiterValue) ||
                !Number.isFinite(totalValue)
            ) {
                throw new Error("Scan returned invalid values.");
            }

            addGasLog({
                liters: litersValue,
                pricePerLiter: pricePerLiterValue,
                total: totalValue,
                isAiScanned: true,
            });

            setScanStatus(
                `Logged ${litersValue.toFixed(2)}L at $${pricePerLiterValue.toFixed(2)}/L.`
            );
        } catch (error) {
            setScanError(error instanceof Error ? error.message : "Scanning failed.");
        } finally {
            setIsScanning(false);
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
        <main className="p-4 pb-28 min-h-screen space-y-6">
            <div className="pt-4 mb-4">
                <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1"><span className="text-primary">Operational</span> Logs</h1>
                <p className="text-muted-foreground text-sm">Track time, fuel, and repairs.</p>
            </div>

            {/* WORK TIMER CARD */}
            <Card className="glass-card border-primary/30 bg-card/40 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                        <span className="flex items-center text-foreground"><Clock className="w-5 h-5 mr-2 text-primary" /> Mowing Session</span>
                        {activeSession && <Badge variant={activeSession.status === 'active' ? 'default' : 'secondary'} className={activeSession.status === 'active' ? 'bg-primary text-primary-foreground animate-pulse' : ''}>
                            {activeSession.status.toUpperCase()}
                        </Badge>}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!activeSession ? (
                        <div className="text-center py-6">
                            <p className="text-muted-foreground mb-4">No active session.</p>
                            <Button onClick={() => startWorkdaySession()} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                                <Play className="w-4 h-4 mr-2" /> Start General Clock-In
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="text-center">
                                <p className="text-sm font-semibold text-primary/80 uppercase tracking-widest mb-1">
                                    General Work
                                </p>
                                <div className="text-6xl font-mono font-bold tracking-tighter text-white drop-shadow-[0_0_15px_rgba(170,255,0,0.4)]">
                                    {formatTime(elapsed)}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant={activeSession.status === 'active' ? 'outline' : 'default'}
                                    onClick={() => toggleWorkdayBreak()}
                                    className={activeSession.status === 'active' ? "border-white/20 text-foreground" : "bg-primary text-primary-foreground"}
                                >
                                    <Pause className="w-4 h-4 mr-2" /> {activeSession.status === 'active' ? 'Start Break' : 'Resume Work'}
                                </Button>
                                <Button onClick={() => endWorkdaySession()} variant="destructive" className="bg-destructive hover:bg-destructive/90 text-white font-bold">
                                    <Square className="w-4 h-4 mr-2" /> End Session
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* DAILY PROFIT SUMMARY */}
            <DailyProfitCard />

            {/* GAS LOG CARD */}
            <Card className="glass-card border-white/10 bg-card/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center text-foreground">
                        <Fuel className="w-5 h-5 mr-2 text-primary" /> Fuel Log
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <input
                        ref={scanFileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleScanFileSelected}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <Dialog open={gasOpen} onOpenChange={setGasOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full border-white/20 bg-background/50 hover:bg-white/10">
                                    <Plus className="w-4 h-4 mr-2" /> Manual Log
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bg-card/90 backdrop-blur-xl border-primary/30">
                                <DialogTitle>Log Fuel Manual</DialogTitle>
                                <div className="space-y-4 pt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Liters (L)</Label>
                                            <Input type="number" value={liters} onChange={e => setLiters(e.target.value)} className="bg-input/50" placeholder="0.00" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Price per L ($)</Label>
                                            <Input type="number" value={pricePerLiter} onChange={e => setPricePerLiter(e.target.value)} className="bg-input/50" placeholder="1.50" />
                                        </div>
                                    </div>
                                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 flex justify-between items-center">
                                        <span className="text-sm text-primary">Total Estimated:</span>
                                        <span className="font-bold text-lg text-primary">${((parseFloat(liters) || 0) * (parseFloat(pricePerLiter) || 0)).toFixed(2)}</span>
                                    </div>
                                    <Button onClick={handleGasSave} className="w-full bg-primary text-primary-foreground">Save Gas Log</Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Button
                            variant="secondary"
                            onClick={handleScanClick}
                            disabled={isScanning}
                            className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-60"
                        >
                            <Scan className="w-4 h-4 mr-2" />
                            {isScanning ? "Scanning..." : "Scan Pump (AI)"}
                        </Button>
                    </div>
                    {scanError && <p className="text-xs text-red-400">{scanError}</p>}
                    {scanStatus && <p className="text-xs text-emerald-400">{scanStatus}</p>}

                    {gasLogs.length > 0 && (
                        <div className="space-y-2 mt-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {gasLogs.slice().reverse().slice(0, 3).map(log => (
                                <div key={log.id} className="flex justify-between items-center p-3 rounded-lg bg-black/30 text-sm">
                                    <div>
                                        <p className="font-semibold text-foreground">{new Date(log.date).toLocaleDateString()}</p>
                                        <p className="text-xs text-muted-foreground">{log.liters.toFixed(2)}L @ ${log.pricePerLiter.toFixed(2)}/L</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-primary">${log.total.toFixed(2)}</p>
                                        {log.isAiScanned && <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 mt-1 border-primary/40 text-primary">AI SCANNED</Badge>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* MAINTENANCE LOG CARD */}
            <Card className="glass-card border-white/10 bg-card/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center text-foreground">
                        <Wrench className="w-5 h-5 mr-2 text-primary" /> Repairs & Maint.
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary">
                                <Plus className="w-4 h-4 mr-2" /> Log Maintenance Event
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md bg-card/90 backdrop-blur-xl border-primary/30 max-h-[80vh] overflow-y-auto">
                            <DialogTitle>Log Maintenance</DialogTitle>
                            <div className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Description / Issue</Label>
                                    <Input value={mDescription} onChange={e => setMDescription(e.target.value)} className="bg-input/50" placeholder="Changed mower blades" />
                                </div>

                                <div className="space-y-2 pt-2 border-t border-white/10">
                                    <Label>Parts Replaced & Costs</Label>
                                    {mParts.map((part, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <Input value={part.name} onChange={e => {
                                                const newParts = [...mParts];
                                                newParts[index].name = e.target.value;
                                                setMParts(newParts);
                                            }} className="bg-input/50 flex-[2]" placeholder="Blade set" />
                                            <Input type="number" value={part.cost} onChange={e => {
                                                const newParts = [...mParts];
                                                newParts[index].cost = e.target.value;
                                                setMParts(newParts);
                                            }} className="bg-input/50 flex-[1]" placeholder="$0.00" />
                                            <Button variant="ghost" size="icon" onClick={() => {
                                                if (mParts.length > 1) {
                                                    setMParts(mParts.filter((_, i) => i !== index));
                                                }
                                            }} className="text-muted-foreground hover:text-destructive shrink-0">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button variant="ghost" size="sm" onClick={() => setMParts([...mParts, { name: "", cost: "" }])} className="text-primary hover:text-primary/80 mt-2 text-xs">
                                        <Plus className="w-3 h-3 mr-1" /> Add Part
                                    </Button>
                                </div>

                                <div className="p-3 bg-white/5 rounded-lg border border-white/10 flex justify-between items-center mt-4">
                                    <span className="text-sm text-foreground">Total Cost:</span>
                                    <span className="font-bold text-lg text-primary">
                                        ${mParts.reduce((acc, p) => acc + (parseFloat(p.cost) || 0), 0).toFixed(2)}
                                    </span>
                                </div>
                                <Button onClick={handleMaintSave} className="w-full bg-primary text-primary-foreground font-bold">Save Maintenance Log</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {maintenanceLogs.length > 0 && (
                        <div className="space-y-2 mt-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {maintenanceLogs.slice().reverse().slice(0, 3).map(log => (
                                <div key={log.id} className="p-3 rounded-lg bg-black/30 text-sm">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="font-semibold text-foreground line-clamp-1 flex-1 pr-2">{log.description}</p>
                                        <p className="font-bold text-primary shrink-0">${log.totalCost.toFixed(2)}</p>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{new Date(log.date).toLocaleDateString()}</span>
                                        <span>{log.parts.length} part(s)</span>
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
        <Card className="glass-card border-white/10 bg-card/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center text-foreground">
                    <Settings2 className="w-5 h-5 mr-2 text-primary" /> Equipment Tracker
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Dialog open={eqOpen} onOpenChange={setEqOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary mb-4">
                            <Plus className="w-4 h-4 mr-2" /> Add Equipment
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-card/90 backdrop-blur-xl border-primary/30 max-h-[80vh] overflow-y-auto">
                        <DialogTitle>Add Equipment</DialogTitle>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Equipment Name</Label>
                                <Input value={eqName} onChange={e => setEqName(e.target.value)} className="bg-input/50" placeholder="Honda HRX217" />
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['mower', 'trimmer', 'blower', 'other'] as const).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setEqType(t)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${eqType === t ? 'bg-primary text-black' : 'bg-white/5 text-muted-foreground hover:text-white'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2 pt-2 border-t border-white/10">
                                <Label>Service Intervals</Label>
                                {serviceItems.map((item, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <Input value={item.name} onChange={e => { const u = [...serviceItems]; u[i].name = e.target.value; setServiceItems(u); }} className="bg-input/50 flex-[2]" placeholder="Service name" />
                                        <Input type="number" value={item.hours} onChange={e => { const u = [...serviceItems]; u[i].hours = e.target.value; setServiceItems(u); }} className="bg-input/50 flex-[1]" placeholder="Hours" />
                                        <span className="text-xs text-muted-foreground">hrs</span>
                                        <Button variant="ghost" size="icon" onClick={() => { if (serviceItems.length > 1) setServiceItems(serviceItems.filter((_, idx) => idx !== i)); }} className="text-muted-foreground hover:text-destructive shrink-0">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="ghost" size="sm" onClick={() => setServiceItems([...serviceItems, { name: "", hours: "" }])} className="text-primary hover:text-primary/80 mt-1 text-xs">
                                    <Plus className="w-3 h-3 mr-1" /> Add Interval
                                </Button>
                            </div>
                            <Button onClick={handleAddEquipment} className="w-full bg-primary text-primary-foreground font-bold">Save Equipment</Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {equipment.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No equipment added yet. Add your mower to start tracking service intervals.</p>
                ) : (
                    <div className="space-y-3">
                        {equipment.map(eq => (
                            <div key={eq.id} className="p-3 rounded-xl bg-black/30 border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <p className="font-bold text-sm text-foreground">{eq.name}</p>
                                        <p className="text-[11px] text-muted-foreground capitalize">{eq.type} &middot; {eq.currentHours.toFixed(1)} hrs</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => deleteEquipment(eq.id)} className="text-muted-foreground hover:text-destructive h-7 w-7">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                                {eq.serviceIntervals.map(si => {
                                    const hoursSince = eq.currentHours - si.lastServiceHours;
                                    const progress = Math.min((hoursSince / si.intervalHours) * 100, 100);
                                    const isOverdue = hoursSince >= si.intervalHours;
                                    const isWarning = progress >= 75;
                                    return (
                                        <div key={si.id} className="flex items-center gap-2 mt-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[11px] text-muted-foreground truncate">{si.name}</span>
                                                    <span className={`text-[10px] font-bold ${isOverdue ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                        {hoursSince.toFixed(1)}h / {si.intervalHours}h
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all ${isOverdue ? 'bg-red-500' : isWarning ? 'bg-orange-400' : 'bg-emerald-400'}`} style={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                            <button onClick={() => markServiceDone(eq.id, si.id)} className={`shrink-0 p-1 rounded-md transition-colors ${isOverdue || isWarning ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground/40 hover:text-muted-foreground'}`} title="Mark as serviced">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
