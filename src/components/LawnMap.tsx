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
                    `https://api.geocod.io/v1.7/geocode?q=${encodeURIComponent(address)}&api_key=${geocodioKey}&format=simple`
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
        <div className="flex flex-col gap-3">
            {/* Address Search */}
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Enter address..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchAddress()}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                />
                <button
                    onClick={searchAddress}
                    disabled={searching}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                    {searching ? "..." : "Go"}
                </button>
            </div>

            {/* Draw Mode Toggle */}
            <div className="flex gap-2">
                <button
                    onClick={() => setDrawMode("lawn")}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${drawMode === "lawn"
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-white/[0.03] text-muted-foreground border border-white/10 hover:border-white/20"
                        }`}
                >
                    🌿 Draw Lawn
                </button>
                <button
                    onClick={() => setDrawMode("obstacle")}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${drawMode === "obstacle"
                        ? "bg-red-500/20 text-red-400 border border-red-500/40"
                        : "bg-white/[0.03] text-muted-foreground border border-white/10 hover:border-white/20"
                        }`}
                >
                    🏠 Mark Obstacle
                </button>
                {(lawnPolygon || obstacles.length > 0) && (
                    <button
                        onClick={clearAll}
                        className="px-3 py-2 rounded-lg bg-white/[0.03] text-muted-foreground border border-white/10 text-sm hover:text-red-400 hover:border-red-500/30 transition-all"
                        title="Clear all"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Mode hint */}
            <div className={`px-3 py-1.5 rounded-lg text-[11px] ${drawMode === "lawn"
                ? "bg-primary/5 text-primary/70 border border-primary/20"
                : "bg-red-500/5 text-red-400/70 border border-red-500/20"
                }`}>
                {drawMode === "lawn"
                    ? "Draw the outer lawn boundary using the polygon tool ▯ in the top-right"
                    : `Mark obstacles (house, driveway, garden beds) to avoid · ${obstacles.length} marked`}
            </div>

            {/* Map */}
            <div
                ref={mapContainerRef}
                className="w-full h-[350px] rounded-xl overflow-hidden border border-white/10"
                style={{ zIndex: 1 }}
            />

            {/* Info Bar */}
            {areaSqFt !== null && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/30">
                    <div>
                        <p className="text-[11px] uppercase text-primary/70 tracking-widest font-medium">Lawn Area</p>
                        <p className="text-xl font-bold text-white">{areaSqFt.toFixed(0)} sq ft</p>
                        <p className="text-[11px] text-muted-foreground">
                            {(areaSqFt / 10.7639).toFixed(0)} m² · {obstacles.length} obstacle{obstacles.length !== 1 ? "s" : ""} marked
                        </p>
                    </div>
                    {routePlan && showRoute && (
                        <div className="text-right">
                            <p className="text-[11px] uppercase text-primary/70 tracking-widest font-medium">Est. Time</p>
                            <p className="text-lg font-bold text-white">{routePlan.estimatedTimeMins.toFixed(0)} min</p>
                            <p className="text-[11px] text-muted-foreground">{routePlan.stripes.length} stripes · {routePlan.bestAngleDeg}°</p>
                        </div>
                    )}
                </div>
            )}

            {/* Mower Settings */}
            {areaSqFt !== null && (
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[11px] uppercase text-muted-foreground tracking-widest font-medium mb-1 block">
                            Deck Width
                        </label>
                        <select
                            value={deckWidth}
                            onChange={(e) => setDeckWidth(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-foreground text-sm focus:border-primary/50 focus:outline-none"
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
                    <div>
                        <label className="text-[11px] uppercase text-muted-foreground tracking-widest font-medium mb-1 block">
                            Discharge Side
                        </label>
                        <select
                            value={discharge}
                            onChange={(e) => setDischarge(e.target.value as DischargeMode)}
                            className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-foreground text-sm focus:border-primary/50 focus:outline-none"
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
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-green-500 text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
                >
                    {showRoute ? "Regenerate Route" : "Generate Mowing Route"}
                </button>
            )}

            {/* Route Stats */}
            {routePlan && showRoute && (
                <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
                        <p className="text-[10px] text-muted-foreground uppercase">Distance</p>
                        <p className="text-sm font-bold text-foreground">{routePlan.estimatedDistanceMeters.toFixed(0)}m</p>
                    </div>
                    <div className="text-center p-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
                        <p className="text-[10px] text-muted-foreground uppercase">Stripes</p>
                        <p className="text-sm font-bold text-foreground">{routePlan.stripes.length}</p>
                    </div>
                    <div className="text-center p-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
                        <p className="text-[10px] text-muted-foreground uppercase">Zones</p>
                        <p className="text-sm font-bold text-foreground">{routePlan.cellCount}</p>
                    </div>
                    <div className="text-center p-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
                        <p className="text-[10px] text-muted-foreground uppercase">Angle</p>
                        <p className="text-sm font-bold text-foreground">{routePlan.bestAngleDeg}°</p>
                    </div>
                </div>
            )}

            {/* Save to Client */}
            {routePlan && showRoute && (
                <div className="relative">
                    {savedSuccess ? (
                        <div className="w-full py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-sm text-center">
                            ✓ Route saved to client!
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowClientPicker(!showClientPicker)}
                                className="w-full py-3 rounded-xl bg-white/[0.06] border border-white/10 text-foreground font-semibold text-sm hover:border-primary/40 hover:bg-primary/5 transition-all"
                            >
                                📸 Save Route to Client
                            </button>
                            {showClientPicker && (
                                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#1a201c] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                                    {clients.length === 0 ? (
                                        <div className="p-4 text-sm text-muted-foreground text-center">No clients yet. Add one on the Addresses tab.</div>
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
                                                className="w-full px-4 py-3 text-left text-sm hover:bg-primary/10 transition-colors border-b border-white/5 last:border-0 flex items-center justify-between"
                                            >
                                                <div>
                                                    <span className="text-white font-medium">{client.name}</span>
                                                    <span className="text-muted-foreground ml-2 text-xs">{client.address}</span>
                                                </div>
                                                {savingToClient === client.id && (
                                                    <span className="text-primary text-xs animate-pulse">Saving...</span>
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
