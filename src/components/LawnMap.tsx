"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as turf from "@turf/turf";
import { planMowingRoute, deckWidthFromInches, type DischargeMode, type RoutePlan } from "@/lib/route-planner";
import { useStore } from "@/lib/store";
import type { Feature, Polygon, Position } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "@/styles/leaflet-overrides.css";
import "leaflet-draw";

// ─── Types ──────────────────────────────────────
type DrawMode = "lawn" | "obstacle";

interface LawnMapProps {
    initialLat?: number;
    initialLng?: number;
    initialAddress?: string;
    onAreaCalculated?: (sqft: number) => void;
    onRoutePlanned?: (plan: RoutePlan) => void;
}

// ─── Component ──────────────────────────────────
export default function LawnMap({
    initialLat = 46.1,
    initialLng = -64.8,
    initialAddress,
    onAreaCalculated,
    onRoutePlanned,
}: LawnMapProps) {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const lawnLayerRef = useRef<L.FeatureGroup | null>(null);
    const obstacleLayerRef = useRef<L.FeatureGroup | null>(null);
    const routeLayerRef = useRef<L.LayerGroup | null>(null);
    const drawControlRef = useRef<L.Control.Draw | null>(null);

    const [address, setAddress] = useState("");
    const [searching, setSearching] = useState(false);
    const [areaSqFt, setAreaSqFt] = useState<number | null>(null);
    const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
    const [deckWidth, setDeckWidth] = useState(21);
    const [discharge, setDischarge] = useState<DischargeMode>("right");
    const [showRoute, setShowRoute] = useState(false);
    const [lawnPolygon, setLawnPolygon] = useState<Feature<Polygon> | null>(null);
    const [obstacles, setObstacles] = useState<Feature<Polygon>[]>([]);
    const [drawMode, setDrawMode] = useState<DrawMode>("lawn");

    // Save to client state
    const { clients, saveClientRoute } = useStore();
    const [showClientPicker, setShowClientPicker] = useState(false);
    const [savingToClient, setSavingToClient] = useState<string | null>(null);
    const [savedSuccess, setSavedSuccess] = useState(false);

    // ─── Initialize Map ─────────────────────────
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [initialLat, initialLng],
            zoom: 18,
            zoomControl: false,
        });

        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { attribution: "© Esri", maxZoom: 20 }
        ).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Layer groups
        const lawnLayer = new L.FeatureGroup();
        map.addLayer(lawnLayer);
        lawnLayerRef.current = lawnLayer;

        const obstacleLayer = new L.FeatureGroup();
        map.addLayer(obstacleLayer);
        obstacleLayerRef.current = obstacleLayer;

        const routeLayer = L.layerGroup();
        map.addLayer(routeLayer);
        routeLayerRef.current = routeLayer;

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // ─── Update Draw Control When Mode Changes ──
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Remove existing draw control
        if (drawControlRef.current) {
            map.removeControl(drawControlRef.current);
        }

        // Remove existing event listeners
        map.off(L.Draw.Event.CREATED);
        map.off(L.Draw.Event.DELETED);

        const isLawn = drawMode === "lawn";
        const color = isLawn ? "#aaff00" : "#ff4444";
        const fillColor = isLawn ? "#aaff00" : "#ff4444";
        const editGroup = isLawn ? lawnLayerRef.current! : obstacleLayerRef.current!;

        const drawControl = new L.Control.Draw({
            position: "topright",
            draw: {
                polygon: {
                    allowIntersection: false,
                    shapeOptions: {
                        color,
                        weight: 2,
                        fillOpacity: isLawn ? 0.05 : 0.3,
                        fillColor,
                    },
                },
                rectangle: {
                    shapeOptions: {
                        color,
                        weight: 2,
                        fillOpacity: isLawn ? 0.05 : 0.3,
                        fillColor,
                    },
                },
                polyline: false,
                circle: false,
                circlemarker: false,
                marker: false,
            },
            edit: {
                featureGroup: editGroup,
                remove: true,
            },
        } as L.Control.DrawConstructorOptions);

        map.addControl(drawControl);
        drawControlRef.current = drawControl;

        // Handle polygon creation
        map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
            const event = e as L.DrawEvents.Created;
            const layer = event.layer;

            if (isLawn) {
                // Only one lawn polygon allowed — replace
                lawnLayerRef.current!.clearLayers();
                routeLayerRef.current!.clearLayers();
                lawnLayerRef.current!.addLayer(layer);

                const geojson = (layer as L.Polygon).toGeoJSON();
                if (geojson.geometry.type === "Polygon") {
                    const poly = geojson as Feature<Polygon>;
                    const areaSqM = turf.area(poly);
                    const sqft = areaSqM * 10.7639;
                    setAreaSqFt(sqft);
                    setLawnPolygon(poly);
                    setShowRoute(false);
                    setRoutePlan(null);
                    onAreaCalculated?.(sqft);
                }
            } else {
                // Multiple obstacles allowed
                obstacleLayerRef.current!.addLayer(layer);
                const geojson = (layer as L.Polygon).toGeoJSON();
                if (geojson.geometry.type === "Polygon") {
                    setObstacles(prev => [...prev, geojson as Feature<Polygon>]);
                    setShowRoute(false);
                    setRoutePlan(null);
                }
            }
        });

        // Handle deletion
        map.on(L.Draw.Event.DELETED, () => {
            if (isLawn) {
                setAreaSqFt(null);
                setLawnPolygon(null);
                setShowRoute(false);
                setRoutePlan(null);
                routeLayerRef.current!.clearLayers();
            } else {
                // Rebuild obstacles from remaining layers
                const remaining: Feature<Polygon>[] = [];
                obstacleLayerRef.current!.eachLayer((layer) => {
                    const geojson = (layer as L.Polygon).toGeoJSON();
                    if (geojson.geometry.type === "Polygon") {
                        remaining.push(geojson as Feature<Polygon>);
                    }
                });
                setObstacles(remaining);
                setShowRoute(false);
                setRoutePlan(null);
            }
        });
    }, [drawMode, onAreaCalculated]);

    // ─── Address Search ─────────────────────────
    const searchAddress = useCallback(async () => {
        if (!address.trim() || !mapRef.current) return;
        setSearching(true);
        try {
            const geocodioKey = process.env.NEXT_PUBLIC_GEOCODIO_API_KEY;

            if (geocodioKey) {
                // Use Geocod.io for rooftop precision
                const res = await fetch(
                    `https://api.geocod.io/v1.7/geocode?q=${encodeURIComponent(address)}&api_key=${geocodioKey}&format=simple&country=Canada`
                );

                const data = await res.json();

                if (data.lat && data.lng) {
                    // GeoCod.io format=simple directly returns lat, lng, and accuracy_type
                    const isPrecise = data.accuracy_type === "rooftop" || data.accuracy_type === "point";
                    const zoomLevel = isPrecise ? 20 : 18;

                    mapRef.current.setView([data.lat, data.lng], zoomLevel);
                } else {
                    console.warn("Geocod.io did not return coordinates:", data);
                }
            } else {
                // Fallback to OSM Nominatim
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=5&addressdetails=1&countrycodes=ca`
                );
                const data = await res.json();
                if (data.length > 0) {
                    // Try to find a building or specific house number first
                    const bestMatch = data.find((item: any) =>
                        item.type === "house" ||
                        item.type === "residential" ||
                        item.type === "building" ||
                        item.class === "building"
                    ) || data[0];

                    const { lat, lon } = bestMatch;

                    // If it's just a street (highway) we stay slightly zoomed out
                    const isPrecise = bestMatch.class === "building" || bestMatch.type === "house";
                    const zoomLevel = isPrecise ? 20 : 18;

                    mapRef.current.setView([parseFloat(lat), parseFloat(lon)], zoomLevel);
                }
            }
        } catch (err) {
            console.error("Geocoding failed:", err);
        }
        setSearching(false);
    }, [address]);

    // ─── Auto-search on Initial Address ─────────
    const hasAutoSearched = useRef(false);
    useEffect(() => {
        if (initialAddress && mapRef.current && !hasAutoSearched.current) {
            hasAutoSearched.current = true;
            setAddress(initialAddress);
            // We need a slight delay to ensure the map is fully stable or just call search
            const timer = setTimeout(() => {
                searchAddress();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [initialAddress, searchAddress]);

    // ─── Generate Route ─────────────────────────
    const generateRoute = useCallback(() => {
        if (!lawnPolygon || !routeLayerRef.current) return;

        const plan = planMowingRoute(lawnPolygon, obstacles, {
            deckWidthMeters: deckWidthFromInches(deckWidth),
            discharge,
            overlapRatio: 0.93,
            headlandLaps: 2,
        });

        routeLayerRef.current.clearLayers();

        // Reduce lawn polygon fill when route is shown
        lawnLayerRef.current?.eachLayer((layer) => {
            if ((layer as L.Polygon).setStyle) {
                (layer as L.Polygon).setStyle({ fillOpacity: 0.03 });
            }
        });

        // Draw stripes — white/cyan for clear contrast on satellite
        plan.stripes.forEach((s, i) => {
            const coords = s.geometry.coordinates.map(c => [c[1], c[0]] as [number, number]);
            L.polyline(coords, {
                color: i % 2 === 0 ? "#ffffff" : "#80e0ff",
                weight: 1.8,
                opacity: 0.6,
            }).addTo(routeLayerRef.current!);
        });

        // Draw directional connectors between consecutive stripes
        for (let i = 0; i < plan.stripes.length - 1; i++) {
            const curr = plan.stripes[i].geometry.coordinates;
            const next = plan.stripes[i + 1].geometry.coordinates;
            if (curr.length < 2 || next.length < 2) continue;

            const endPt = curr[curr.length - 1];
            const startPt = next[0];

            // Only connect if they're close (same zone)
            const dist = Math.hypot(endPt[0] - startPt[0], endPt[1] - startPt[1]);
            if (dist < 0.001) {
                // Small directional arrow at midpoint
                const midLat = (endPt[1] + startPt[1]) / 2;
                const midLon = (endPt[0] + startPt[0]) / 2;
                const angleDeg = Math.atan2(startPt[1] - endPt[1], startPt[0] - endPt[0]) * 180 / Math.PI;

                const arrowIcon = L.divIcon({
                    html: `<div style="transform:rotate(${angleDeg - 90}deg);color:#80e0ff;font-size:7px;opacity:0.4;line-height:1">▲</div>`,
                    className: "",
                    iconSize: [7, 7],
                    iconAnchor: [3, 3],
                });
                L.marker([midLat, midLon], { icon: arrowIcon, interactive: false })
                    .addTo(routeLayerRef.current!);
            }
        }

        setRoutePlan(plan);
        setShowRoute(true);
        onRoutePlanned?.(plan);
    }, [lawnPolygon, obstacles, deckWidth, discharge, onRoutePlanned]);

    // ─── Clear All ──────────────────────────────
    const clearAll = useCallback(() => {
        lawnLayerRef.current?.clearLayers();
        obstacleLayerRef.current?.clearLayers();
        routeLayerRef.current?.clearLayers();
        setAreaSqFt(null);
        setLawnPolygon(null);
        setObstacles([]);
        setShowRoute(false);
        setRoutePlan(null);
    }, []);

    // ─── Render ─────────────────────────────────
    return (
        <div className="flex flex-col gap-4">
            {/* Address Search */}
            <div className="flex gap-2 relative z-10 w-full">
                <input
                    type="text"
                    placeholder="Enter an address to map..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchAddress()}
                    className="flex-1 px-4 py-3 h-12 rounded-xl bg-card border border-white/5 text-white text-sm placeholder:text-white/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 focus:outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] transition-all"
                />
                <button
                    onClick={searchAddress}
                    disabled={searching}
                    className="px-6 h-12 rounded-xl bg-primary text-black font-bold text-sm tracking-wide hover:bg-primary/90 disabled:opacity-50 shadow-[0_4px_15px_rgba(195,255,0,0.2)] transition-all active:scale-[0.98]"
                >
                    {searching ? "..." : "Launch"}
                </button>
            </div>

            {/* Draw Mode Toggle */}
            <div className="flex gap-2 relative z-10">
                <button
                    onClick={() => setDrawMode("lawn")}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold tracking-wide transition-all shadow-sm ${drawMode === "lawn"
                        ? "bg-primary/15 text-primary border border-primary/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] ring-1 ring-primary/20"
                        : "bg-card text-white/50 border border-white/5 hover:text-white/80 hover:bg-white/5"
                        }`}
                >
                    <span className="mr-2 opacity-80">🌿</span> Draw Lawn
                </button>
                <button
                    onClick={() => setDrawMode("obstacle")}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold tracking-wide transition-all shadow-sm ${drawMode === "obstacle"
                        ? "bg-red-500/15 text-red-400 border border-red-500/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] ring-1 ring-red-500/20"
                        : "bg-card text-white/50 border border-white/5 hover:text-white/80 hover:bg-white/5"
                        }`}
                >
                    <span className="mr-2 opacity-80">🏠</span> Obstacle
                </button>
                {(lawnPolygon || obstacles.length > 0) && (
                    <button
                        onClick={clearAll}
                        className="px-4 py-3 rounded-xl bg-card text-white/40 border border-white/5 text-sm hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all font-bold group"
                        title="Clear all"
                    >
                        <span className="group-hover:scale-110 transition-transform block">✕</span>
                    </button>
                )}
            </div>

            {/* Mode hint */}
            <div className={`px-4 py-2.5 rounded-xl text-xs font-medium tracking-wide border shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] ${drawMode === "lawn"
                ? "bg-primary/5 text-primary/80 border-primary/10"
                : "bg-red-500/5 text-red-400/80 border-red-500/10"
                }`}>
                {drawMode === "lawn"
                    ? "Draw the outer lawn boundary using the polygon tool (top-right)"
                    : `Mark obstacles (house, driveway, garden beds) to avoid · ${obstacles.length} marked`}
            </div>

            {/* Map */}
            <div
                ref={mapContainerRef}
                className="w-full h-[450px] md:h-[500px] rounded-[1.5rem] overflow-hidden border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.3)] bg-card"
                style={{ zIndex: 1 }}
            />

            {/* Info Bar */}
            {areaSqFt !== null && (
                <div className="flex items-center justify-between p-5 rounded-2xl bg-card border border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.02)] animate-in fade-in slide-in-from-bottom-2">
                    <div>
                        <p className="text-[10px] uppercase text-white/50 tracking-[0.2em] font-bold mb-1 ml-0.5">Lawn Area</p>
                        <p className="text-3xl font-heading font-bold text-white tracking-tight">{areaSqFt.toFixed(0)} sq ft</p>
                        <p className="text-xs text-primary/70 font-medium tracking-wide mt-1 bg-primary/10 inline-block px-2 py-0.5 rounded-md border border-primary/20">
                            {(areaSqFt / 10.7639).toFixed(0)} m² · {obstacles.length} obstacle{obstacles.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                    {routePlan && showRoute && (
                        <div className="text-right">
                            <p className="text-[10px] uppercase text-white/50 tracking-[0.2em] font-bold mb-1 mr-0.5">Est. Time</p>
                            <p className="text-3xl font-heading font-bold text-primary tracking-tight">{routePlan.estimatedTimeMins.toFixed(0)}<span className="text-xl text-primary/70 ml-1">min</span></p>
                            <p className="text-xs text-white/40 font-medium tracking-wide mt-1">
                                {routePlan.stripes.length} stripes · {routePlan.bestAngleDeg}°
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Mower Settings */}
            {areaSqFt !== null && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase text-white/50 tracking-widest font-bold ml-1">
                            Deck Width
                        </label>
                        <select
                            value={deckWidth}
                            onChange={(e) => setDeckWidth(Number(e.target.value))}
                            className="w-full px-4 h-12 rounded-xl bg-card border border-white/10 text-white text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 focus:outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] appearance-none cursor-pointer"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                        >
                            <option value={21}>21&quot; (Push)</option>
                            <option value={30}>30&quot; (Wide Push)</option>
                            <option value={36}>36&quot; (Walk-Behind)</option>
                            <option value={42}>42&quot; (Ride-On Small)</option>
                            <option value={48}>48&quot; (Ride-On)</option>
                            <option value={54}>54&quot; (Ride-On Large)</option>
                            <option value={60}>60&quot; (Commercial)</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase text-white/50 tracking-widest font-bold ml-1">
                            Discharge Mode
                        </label>
                        <select
                            value={discharge}
                            onChange={(e) => setDischarge(e.target.value as DischargeMode)}
                            className="w-full px-4 h-12 rounded-xl bg-card border border-white/10 text-white text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 focus:outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] appearance-none cursor-pointer"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                        >
                            <option value="right">Right Side</option>
                            <option value="left">Left Side</option>
                            <option value="rear">Rear Discharge</option>
                            <option value="mulch">Mulching (No Discharge)</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Generate Route Button */}
            {areaSqFt !== null && (
                <button
                    onClick={generateRoute}
                    className="w-full h-14 mt-2 rounded-[1rem] bg-primary text-black font-bold text-base tracking-wide shadow-[0_4px_20px_rgba(195,255,0,0.3)] hover:bg-primary/90 transition-all active:scale-[0.98] animate-in fade-in zoom-in-95 duration-500 delay-100"
                >
                    {showRoute ? "Regenerate optimal route" : "Generate Optimal Mowing Route"}
                </button>
            )}

            {/* Route Stats */}
            {routePlan && showRoute && (
                <div className="grid grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-5 duration-500">
                    <div className="text-center p-3 rounded-2xl border border-white/5 bg-card shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Dist</p>
                        <p className="text-sm font-heading font-bold text-white">{routePlan.estimatedDistanceMeters.toFixed(0)}m</p>
                    </div>
                    <div className="text-center p-3 rounded-2xl border border-white/5 bg-card shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Stripes</p>
                        <p className="text-sm font-heading font-bold text-white">{routePlan.stripes.length}</p>
                    </div>
                    <div className="text-center p-3 rounded-2xl border border-white/5 bg-card shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Zones</p>
                        <p className="text-sm font-heading font-bold text-white">{routePlan.cellCount}</p>
                    </div>
                    <div className="text-center p-3 rounded-2xl border border-white/5 bg-card shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Angle</p>
                        <p className="text-sm font-heading font-bold text-white">{routePlan.bestAngleDeg}°</p>
                    </div>
                </div>
            )}

            {/* Save to Client */}
            {routePlan && showRoute && (
                <div className="relative animate-in fade-in slide-in-from-bottom-6 duration-500 py-2">
                    {savedSuccess ? (
                        <div className="w-full h-14 flex items-center justify-center rounded-[1rem] bg-primary/20 border border-primary/40 text-primary font-bold text-sm tracking-wide shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                            <span className="mr-2">✓</span> Route Saved Successfully
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowClientPicker(!showClientPicker)}
                                className="w-full h-14 rounded-[1rem] bg-card border border-white/10 text-white font-bold text-sm hover:border-primary/40 hover:bg-white/5 transition-all tracking-wide shadow-[0_4px_12px_rgba(0,0,0,0.2)] flex items-center justify-center gap-2 group"
                            >
                                <span className="group-hover:scale-110 transition-transform">📸</span> Save Route to Address
                            </button>
                            {showClientPicker && (
                                <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#151a17] border border-white/10 rounded-[1.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.6)] overflow-hidden max-h-60 overflow-y-auto custom-scrollbar backdrop-blur-2xl">
                                    {clients.length === 0 ? (
                                        <div className="p-6 text-sm font-medium text-white/40 text-center">No addresses saved yet. <br /> Add one on the Addresses tab.</div>
                                    ) : (
                                        clients.map((client) => (
                                            <button
                                                key={client.id}
                                                onClick={async () => {
                                                    setSavingToClient(client.id);
                                                    setShowClientPicker(false);

                                                    const center = mapRef.current?.getCenter();
                                                    if (!center) { setSavingToClient(null); return; }

                                                    // Always save coordinates first
                                                    let screenshot = 'saved';

                                                    // Try screenshot as bonus (may fail due to CORS on tiles)
                                                    try {
                                                        const html2canvas = (await import("html2canvas")).default;
                                                        const mapEl = mapContainerRef.current;
                                                        if (mapEl) {
                                                            const canvas = await html2canvas(mapEl, {
                                                                useCORS: true,
                                                                allowTaint: true,
                                                                backgroundColor: '#0a0f0d',
                                                                scale: 1,
                                                                logging: false,
                                                            });
                                                            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                                                            // Only use if it's a real image (not blank)
                                                            if (dataUrl.length > 1000) screenshot = dataUrl;
                                                        }
                                                    } catch (err) {
                                                        console.warn('Screenshot capture skipped:', err);
                                                    }

                                                    saveClientRoute(client.id, screenshot, center.lat, center.lng);
                                                    setSavedSuccess(true);
                                                    setTimeout(() => setSavedSuccess(false), 3000);
                                                    setSavingToClient(null);
                                                }}
                                                disabled={savingToClient !== null}
                                                className="w-full px-5 py-4 text-left hover:bg-primary/10 transition-all border-b border-white/5 last:border-0 flex items-center justify-between group"
                                            >
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <span className="text-white font-bold block truncate group-hover:text-primary transition-colors">{client.name}</span>
                                                    <span className="text-white/40 text-[11px] block truncate mt-0.5">{client.address}</span>
                                                </div>
                                                {savingToClient === client.id ? (
                                                    <span className="text-[10px] text-primary font-bold uppercase tracking-widest animate-pulse whitespace-nowrap">Saving...</span>
                                                ) : (
                                                    <span className="text-white/20 group-hover:text-primary/70 transition-colors opacity-0 group-hover:opacity-100">
                                                        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                                    </span>
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
