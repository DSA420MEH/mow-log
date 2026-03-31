"use client";

import { Camera } from "lucide-react";
import { Button } from "./ui/button";
import { exportToPDF } from "@/lib/export-utils";

export function ExportButton() {
    return (
        <Button
            onClick={() => exportToPDF('app-root', `mowlog-snapshot-${new Date().toISOString().split('T')[0]}`)}
            className="fixed top-4 right-4 z-[100] rounded-full w-12 h-12 shadow-lg shadow-black/50 bg-primary/20 hover:bg-primary/40 text-primary border border-primary/50 backdrop-blur-md transition-all flex items-center justify-center p-0"
            title="Export PDF (Snapshot)"
            aria-label="Export PDF Snapshot"
        >
            <Camera className="w-5 h-5" />
        </Button>
    );
}
