"use client";

import { useStore } from "@/lib/store";
import { getSeedData } from "@/lib/seed-data";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Download, Upload, Database, Trash2 } from "lucide-react";

export function SettingsModal() {
    const store = useStore();

    const handleExport = () => {
        const data = JSON.stringify({
            clients: store.clients,
            sessions: store.sessions,
            gasLogs: store.gasLogs,
            maintenanceLogs: store.maintenanceLogs,
            equipment: store.equipment,
        }, null, 2);

        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mowlog-backup-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                if (data.clients && data.sessions) {
                    useStore.setState({
                        clients: data.clients,
                        sessions: data.sessions,
                        gasLogs: data.gasLogs || [],
                        maintenanceLogs: data.maintenanceLogs || [],
                        equipment: data.equipment || [],
                    });
                    alert("Data imported successfully!");
                }
            } catch {
                alert("Invalid backup file.");
            }
        };
        reader.readAsText(file);
    };

    const handleLoadDemo = () => {
        if (!confirm("Load demo data? This will replace all current data with sample clients, sessions, and logs.")) return;
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
            activeWorkdaySessionId: null,
            activeMowSessionId: null,
        });
        alert("Previous season data loaded! 🌿 12 clients, 62 sessions, and your gas logs are now synchronized.");
    };

    const handleClearAll = () => {
        if (!confirm("⚠️ This will permanently delete ALL your data. Are you sure?")) return;
        useStore.setState({
            clients: [],
            sessions: [],
            gasLogs: [],
            maintenanceLogs: [],
            equipment: [],
            activeWorkdaySessionId: null,
            activeMowSessionId: null,
            userName: '',
            homeAddress: '',
            homeLat: undefined,
            homeLng: undefined,
            homeLawnBoundary: undefined,
            homeObstacles: undefined,
        });
        alert("All data cleared.");
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                    <Settings className="w-5 h-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md premium-glass glass-edge-highlight border-primary/30 text-foreground overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                <DialogTitle className="text-xl font-black uppercase tracking-widest text-white drop-shadow-md">Settings & Data</DialogTitle>
                <div className="space-y-4 pt-4">
                    <Button onClick={handleExport} className="w-full glass-card hover:glass-card-hover border-white/10 justify-start transition-all text-white">
                        <Download className="w-4 h-4 mr-3 text-primary" /> Export All Data (JSON)
                    </Button>

                    <div className="relative">
                        <Input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <Button variant="outline" className="w-full glass-card hover:glass-card-hover border-white/10 justify-start transition-all text-white">
                            <Upload className="w-4 h-4 mr-3 text-primary" /> Import Data Backup
                        </Button>
                    </div>

                    <div className="pt-4 border-t border-white/10 space-y-3 mt-2">
                        <p className="text-[10px] uppercase tracking-widest text-primary font-black opacity-80 mb-2">Data Management</p>
                        <Button onClick={handleLoadDemo} variant="outline" className="w-full stealth-noir-glass border-primary/30 hover:bg-primary/20 hover:border-primary/50 text-white justify-start transition-all">
                            <Database className="w-4 h-4 mr-3 text-primary" /> Load Demo Data ({store.clients.length === 0 ? "Ready" : "Overlay"})
                        </Button>
                        <Button onClick={handleClearAll} variant="outline" className="w-full stealth-noir-glass border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 justify-start transition-all">
                            <Trash2 className="w-4 h-4 mr-3" /> Clear All Data
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Ensure Input is defined locally or exported from UI since it's just a file input. 
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} /> }

