"use client";

import dynamic from "next/dynamic";
import { MapPin, Navigation, Home, Route, ExternalLink, Fuel } from "lucide-react";
import { useStore } from "@/lib/store";
import { optimizeRoute, type OptimizedRoute } from "@/lib/route-optimizer";
import { useState, useCallback } from "react";

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
    const { clients, homeAddress, homeLat, homeLng, setHomeAddress, fuelCostPerKm } = useStore();
    const clientsWithCoords = clients.filter(c => c.lat && c.lng);

    const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
    const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
    const [homeInput, setHomeInput] = useState(homeAddress || "");
    const [settingHome, setSettingHome] = useState(false);
    const [showDailyRoute, setShowDailyRoute] = useState(false);

    const toggleClient = (id: string) => {
        setSelectedClientIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
        setOptimizedRoute(null);
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
            }));

        const result = optimizeRoute(homeLat, homeLng, selected, fuelCostPerKm);
        setOptimizedRoute(result);
    };

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

            {/* Daily Route Optimizer */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <button
                    onClick={() => setShowDailyRoute(!showDailyRoute)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Route className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold text-white">Plan Today&apos;s Driving Route</span>
                        {clientsWithCoords.length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                {clientsWithCoords.length} clients with routes
                            </span>
                        )}
                    </div>
                    <span className="text-muted-foreground text-sm">{showDailyRoute ? "▲" : "▼"}</span>
                </button>

                {showDailyRoute && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                        {/* Home Address Setup */}
                        <div className="pt-3">
                            <label className="text-[11px] uppercase text-muted-foreground tracking-widest font-medium mb-1.5 flex items-center gap-1">
                                <Home className="w-3 h-3" /> Home Address
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter your home address..."
                                    value={homeInput}
                                    onChange={(e) => setHomeInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && geocodeHome()}
                                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                                />
                                <button
                                    onClick={geocodeHome}
                                    disabled={settingHome}
                                    className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-sm font-semibold hover:bg-primary/30 disabled:opacity-50 transition-colors"
                                >
                                    {settingHome ? "..." : homeLat ? "Update" : "Set"}
                                </button>
                            </div>
                            {homeLat && homeLng && (
                                <p className="text-[10px] text-primary/60 mt-1">✓ Home set at {homeLat.toFixed(4)}, {homeLng.toFixed(4)}</p>
                            )}
                        </div>

                        {/* Client Selection */}
                        {clientsWithCoords.length === 0 ? (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                                No clients with saved routes yet. Draw a route and save it to a client first.
                            </div>
                        ) : (
                            <div>
                                <label className="text-[11px] uppercase text-muted-foreground tracking-widest font-medium mb-1.5 block">
                                    Select clients to visit today
                                </label>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {clientsWithCoords.map(client => (
                                        <button
                                            key={client.id}
                                            onClick={() => toggleClient(client.id)}
                                            className={`w-full px-3 py-2.5 rounded-lg text-left text-sm flex items-center gap-3 transition-all ${selectedClientIds.has(client.id)
                                                ? "bg-primary/15 border border-primary/30 text-white"
                                                : "bg-white/[0.03] border border-white/5 text-muted-foreground hover:border-white/15"
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs ${selectedClientIds.has(client.id)
                                                ? "border-primary bg-primary text-black font-bold"
                                                : "border-white/20"
                                                }`}>
                                                {selectedClientIds.has(client.id) && "✓"}
                                            </div>
                                            <div className="flex-1">
                                                <span className="font-medium text-white">{client.name}</span>
                                                <span className="ml-2 text-xs text-muted-foreground">{client.address}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Generate Button */}
                        {homeLat && selectedClientIds.size > 0 && (
                            <button
                                onClick={generateDailyRoute}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-sm hover:opacity-90 transition-opacity"
                            >
                                Generate Driving Route ({selectedClientIds.size} stop{selectedClientIds.size !== 1 ? "s" : ""})
                            </button>
                        )}

                        {/* Optimized Route Result */}
                        {optimizedRoute && optimizedRoute.stops.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] uppercase text-primary/70 tracking-widest font-medium">
                                        Optimized Order
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        ~{optimizedRoute.totalDistanceKm.toFixed(1)} km total drive
                                    </span>
                                </div>

                                {/* Fuel Cost Estimate */}
                                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm">
                                    <Fuel className="w-4 h-4 text-orange-400 shrink-0" />
                                    <div className="flex-1">
                                        <span className="text-orange-400 font-bold">${optimizedRoute.estimatedFuelCost.toFixed(2)}</span>
                                        <span className="text-muted-foreground"> est. fuel cost</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                        ~{optimizedRoute.estimatedFuelLiters.toFixed(1)}L
                                    </span>
                                </div>

                                {/* Home Start */}
                                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                                        <Home className="w-3 h-3" />
                                    </div>
                                    <span className="text-emerald-400 font-medium">Start: Home</span>
                                </div>

                                {/* Stops */}
                                {optimizedRoute.stops.map((stop, idx) => (
                                    <div key={stop.clientId} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-sm">
                                        <div className="w-6 h-6 rounded-full bg-primary text-black flex items-center justify-center text-xs font-bold shrink-0">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium truncate">{stop.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{stop.address}</p>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                            {stop.distanceFromPrevKm.toFixed(1)} km
                                        </span>
                                    </div>
                                ))}

                                {/* Home Return */}
                                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                                        <Home className="w-3 h-3" />
                                    </div>
                                    <span className="text-emerald-400 font-medium">Return Home</span>
                                </div>

                                {/* Google Maps Link */}
                                <a
                                    href={optimizedRoute.googleMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white font-semibold text-sm hover:border-primary/40 hover:bg-primary/5 transition-all"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Open in Google Maps
                                </a>
                            </div>
                        )}
                    </div>
                )}
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
