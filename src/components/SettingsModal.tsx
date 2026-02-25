"use client";

import { useStore } from "@/lib/store";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings, Download, Upload } from "lucide-react";

export function SettingsModal() {
    const store = useStore();

    const handleExport = () => {
        const data = JSON.stringify({
            clients: store.clients,
            sessions: store.sessions,
            gasLogs: store.gasLogs,
            maintenanceLogs: store.maintenanceLogs,
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
                    });
                    alert("Data imported successfully!");
                }
            } catch {
                alert("Invalid backup file.");
            }
        };
        reader.readAsText(file);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                    <Settings className="w-5 h-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card/90 backdrop-blur-xl border-primary/30 text-foreground">
                <DialogTitle className="text-xl font-bold">Settings & Data</DialogTitle>
                <div className="space-y-4 pt-4">
                    <Button onClick={handleExport} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 justify-start">
                        <Download className="w-4 h-4 mr-3" /> Export All Data (JSON)
                    </Button>

                    <div className="relative">
                        <Input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <Button variant="outline" className="w-full border-primary/30 justify-start">
                            <Upload className="w-4 h-4 mr-3" /> Import Data Backup
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Ensure Input is defined locally or exported from UI since it's just a file input. 
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} /> }
