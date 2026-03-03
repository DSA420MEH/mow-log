"use client";

import dynamic from "next/dynamic";
import { MapPin, Navigation, Home, Route, ExternalLink, Fuel, ArrowLeft, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { optimizeRoute, type OptimizedRoute } from "@/lib/route-optimizer";
import { useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

// Leaflet uses `window` so must be dynamically imported with SSR disabled
const LawnMap = dynamic(() => import("@/components/LawnMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[350px] rounded-[1.5rem] bg-card/50 border border-white/5 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]">
            <div className="text-center">
                <MapPin className="w-8 h-8 text-primary/40 mx-auto mb-2 animate-pulse" />
                <p className="text-sm font-medium text-white/50 tracking-wide">Loading map interface...</p>
            </div>
        </div>
    ),
});

function RoutePlannerContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initClientId = searchParams.get("initClient");

    const { clients, homeAddress, homeLat, homeLng, setHomeAddress, fuelCostPerKm } = useStore();
    const clientsWithCoords = clients.filter(c => c.lat && c.lng);

    // Find client for initialization
    const initClient = useMemo(() =>
        clients.find(c => c.id === initClientId),
        [clients, initClientId]
    );

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
        <main className="p-4 md:p-8 pb-28 min-h-screen bg-[#0a0f0d] space-y-6">
            <div className="pt-4 mb-2 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                            <Navigation className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-3xl md:text-5xl font-heading font-bold tracking-tight text-white">
                            Route Planner
                        </h1>
                    </div>
                    <p className="text-white/60 text-sm md:text-base tracking-wide flex items-center gap-2">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/80"></span> Draw boundaries
                        <span className="inline-block w-1 h-1 rounded-full bg-white/20 mx-1"></span>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/80"></span> Generate routes
                    </p>
                </div>
                <button
                    onClick={() => router.push("/addresses")}
                    className="h-10 px-4 rounded-xl bg-card border border-white/5 text-white/60 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 text-xs font-bold tracking-widest shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                >
                    <ArrowLeft className="w-4 h-4" />
                    BACK
                </button>
            </div>

            {initClient && (
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 animate-in fade-in slide-in-from-top-4 duration-500">
                    <p className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        Initializing Route for {initClient.name}
                    </p>
                    <p className="text-xs text-primary/70">
                        Map focused on {initClient.address}. Draw the lawn boundary to begin.
                    </p>
                </div>
            )}

            {/* Daily Route Optimizer */}
            <div className="rounded-[1.5rem] border border-white/5 bg-card/50 overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.02)] backdrop-blur-xl">
                <button
                    onClick={() => setShowDailyRoute(!showDailyRoute)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 group-hover:border-primary/30 transition-colors">
                            <Route className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-base font-heading font-bold text-white tracking-wide">Plan Today&apos;s Driving Route</span>
                        {clientsWithCoords.length > 0 && (
                            <span className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold tracking-widest uppercase border border-primary/20 ml-2 shadow-[inset_0_0_10px_rgba(195,255,0,0.1)]">
                                {clientsWithCoords.length} saved
                            </span>
                        )}
                    </div>
                    <span className="text-white/40 text-sm transition-transform duration-300" style={{ transform: showDailyRoute ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>

                {showDailyRoute && (
                    <div className="px-5 pb-5 space-y-5 border-t border-white/5 bg-black/20">
                        {/* Home Address Setup */}
                        <div className="pt-4">
                            <label className="text-[10px] uppercase text-white/50 tracking-widest font-bold mb-2 flex items-center gap-1.5 ml-1">
                                <Home className="w-3.5 h-3.5 opacity-70" /> Home Base Address
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter your starting address..."
                                    value={homeInput}
                                    onChange={(e) => setHomeInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && geocodeHome()}
                                    className="flex-1 px-4 py-3 h-12 rounded-xl bg-white/[0.03] border border-white/10 text-white text-sm placeholder:text-white/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 focus:outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] transition-all"
                                />
                                <button
                                    onClick={geocodeHome}
                                    disabled={settingHome}
                                    className="px-5 h-12 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 hover:border-white/20 disabled:opacity-50 transition-all tracking-wide"
                                >
                                    {settingHome ? "..." : homeLat ? "Update" : "Set Base"}
                                </button>
                            </div>
                            {homeLat && homeLng && (
                                <p className="text-[11px] text-primary mt-2 ml-1 font-medium tracking-wide flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                    Base locked: {homeLat.toFixed(4)}, {homeLng.toFixed(4)}
                                </p>
                            )}
                        </div>

                        {/* Client Selection */}
                        {clientsWithCoords.length === 0 ? (
                            <div className="py-6 text-center text-sm font-medium text-white/40 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                                No clients with saved routes yet.<br />Draw a route and save it to a client first.
                            </div>
                        ) : (
                            <div className="pt-2">
                                <label className="text-[10px] uppercase text-white/50 tracking-widest font-bold mb-3 block ml-1">
                                    Select Stops For Today
                                </label>
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                                    {clientsWithCoords.map(client => (
                                        <button
                                            key={client.id}
                                            onClick={() => toggleClient(client.id)}
                                            className={`w-full px-4 py-3 rounded-xl text-left flex items-center gap-4 transition-all ${selectedClientIds.has(client.id)
                                                ? "bg-primary/10 border-primary/30 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_0_15px_rgba(195,255,0,0.05)] ring-1 ring-primary/20"
                                                : "bg-white/[0.02] border-transparent hover:bg-white/[0.04] text-white/60 hover:text-white"
                                                } border border-solid`}
                                        >
                                            <div className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center transition-all ${selectedClientIds.has(client.id)
                                                ? "border-primary bg-primary text-black"
                                                : "border-white/20 bg-black/40"
                                                }`}>
                                                {selectedClientIds.has(client.id) && <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="font-bold text-sm truncate block">{client.name}</span>
                                                <span className="text-xs opacity-60 truncate block mt-0.5">{client.address}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Generate Button */}
                        {homeLat && selectedClientIds.size > 0 && (
                            <div className="pt-4">
                                <button
                                    onClick={generateDailyRoute}
                                    className="w-full py-4 rounded-xl bg-primary text-black font-bold text-sm tracking-wide shadow-[0_4px_20px_rgba(195,255,0,0.3)] hover:bg-primary/90 transition-all active:scale-[0.98]"
                                >
                                    Generate Optimal Route ({selectedClientIds.size} stop{selectedClientIds.size !== 1 ? "s" : ""})
                                </button>
                            </div>
                        )}

                        {/* Optimized Route Result */}
                        {optimizedRoute && optimizedRoute.stops.length > 0 && (
                            <div className="space-y-3 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] uppercase text-primary tracking-widest font-bold">
                                        Optimized Stop Order
                                    </span>
                                    <span className="text-[11px] text-white/50 tracking-wide font-medium bg-white/5 px-2 py-1 rounded-md">
                                        {optimizedRoute.totalDistanceKm.toFixed(1)} km total
                                    </span>
                                </div>

                                {/* Fuel Cost Estimate */}
                                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                                    <div className="p-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30">
                                        <Fuel className="w-4 h-4 text-orange-400 shrink-0" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-orange-400 font-bold tracking-wide">${optimizedRoute.estimatedFuelCost.toFixed(2)}</span>
                                        <span className="text-white/60 ml-1">est. fuel</span>
                                    </div>
                                    <span className="text-xs text-orange-400/80 font-medium bg-orange-500/10 px-2 py-0.5 rounded-md">
                                        {optimizedRoute.estimatedFuelLiters.toFixed(1)}L
                                    </span>
                                </div>

                                {/* Home Start */}
                                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a201c] border border-white/5 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold">
                                        <Home className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-white/80 font-bold tracking-wide">Start: Home Base</span>
                                </div>

                                {/* Stops */}
                                {optimizedRoute.stops.map((stop, idx) => (
                                    <div key={stop.clientId} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm hover:border-white/20 transition-all shadow-sm">
                                        <div className="w-7 h-7 rounded-full bg-primary text-black flex items-center justify-center text-xs font-bold shrink-0 shadow-[0_0_10px_rgba(195,255,0,0.3)]">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold truncate">{stop.name}</p>
                                            <p className="text-xs text-white/50 truncate mt-0.5">{stop.address}</p>
                                        </div>
                                        <span className="text-[11px] font-medium text-white/40 shrink-0 bg-black/40 px-2 py-1 rounded-md border border-white/5">
                                            +{stop.distanceFromPrevKm.toFixed(1)} km
                                        </span>
                                    </div>
                                ))}

                                {/* Home Return */}
                                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a201c] border border-white/5 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold">
                                        <Home className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-white/80 font-bold tracking-wide">Return: Home Base</span>
                                </div>

                                {/* Google Maps Link */}
                                <div className="pt-2">
                                    <a
                                        href={optimizedRoute.googleMapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm tracking-wide hover:border-primary/40 hover:bg-white/10 transition-all group"
                                    >
                                        <ExternalLink className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                                        Launch Navigation
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Instructions */}
            <div className="p-4 rounded-xl bg-card/60 border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] backdrop-blur-sm">
                <p className="text-xs text-white/60 leading-relaxed max-w-3xl">
                    <strong className="text-white font-bold tracking-wide uppercase text-[10px]">Step 1:</strong>{" "}
                    Search address → draw the <span className="text-primary font-bold">lawn boundary</span> (green).{" "}
                    <strong className="text-white font-bold tracking-wide uppercase text-[10px] ml-2">Step 2:</strong>{" "}
                    Switch to <span className="text-red-400 font-bold">Mark Obstacle</span> → draw the house, driveway, beds (red).{" "}
                    <strong className="text-white font-bold tracking-wide uppercase text-[10px] ml-2">Step 3:</strong>{" "}
                    Set mower specs → Generate Route.
                </p>
            </div>

            {/* Map Component Container */}
            <div className="rounded-[1.5rem] overflow-hidden border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.3)] bg-card">
                <LawnMap initialAddress={initClient?.address} />
            </div>
        </main>
    );
}

export default function RoutePlannerPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Zap className="w-12 h-12 text-primary animate-pulse" />
                    <span className="text-sm font-bold text-primary uppercase tracking-widest">Initializing Planner...</span>
                </div>
            </div>
        }>
            <RoutePlannerContent />
        </Suspense>
    );
}
