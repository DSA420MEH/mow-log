"use client";

import dynamic from "next/dynamic";
import { MapPin, Navigation } from "lucide-react";

// Leaflet uses `window` so must be dynamically imported with SSR disabled
const LawnMap = dynamic(() => import("@/components/LawnMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[350px] rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
            <div className="text-center">
                <MapPin className="w-8 h-8 text-primary/40 mx-auto mb-2 animate-pulse" />
                <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
        </div>
    ),
});

export default function RoutePlannerPage() {
    return (
        <main className="p-4 pb-28 min-h-screen space-y-4">
            <div className="pt-4 mb-2">
                <div className="flex items-center gap-2 mb-1">
                    <Navigation className="w-5 h-5 text-primary" />
                    <h1 className="text-2xl font-extrabold tracking-tight text-white">
                        <span className="text-primary">Route</span> Planner
                    </h1>
                </div>
                <p className="text-muted-foreground text-xs">Draw lawn boundaries on satellite view · Generate optimal mowing routes</p>
            </div>

            {/* Instructions */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Step 1:</strong>{" "}
                    Search address → draw the <span className="text-primary font-semibold">lawn boundary</span> (green).{" "}
                    <strong className="text-foreground">Step 2:</strong>{" "}
                    Switch to <span className="text-red-400 font-semibold">Mark Obstacle</span> → draw the house, driveway, beds (red).{" "}
                    <strong className="text-foreground">Step 3:</strong>{" "}
                    Set mower specs → Generate Route.
                </p>
            </div>

            {/* Map Component */}
            <LawnMap />
        </main>
    );
}
