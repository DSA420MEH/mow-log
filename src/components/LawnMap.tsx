"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as turf from "@turf/turf";
import { planMowingRoute, deckWidthFromInches, type DischargeMode, type RoutePlan } from "@/lib/route-planner";
import type { Feature, Polygon, Position } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";

// ─── Types ──────────────────────────────────────
interface LawnMapProps {
    initialLat?: number;
    initialLng?: number;
    onAreaCalculated?: (sqft: number) => void;
    onRoutePlanned?: (plan: RoutePlan) => void;
}

// ─── Component ──────────────────────────────────
export default function LawnMap({
    initialLat = 46.1,
    initialLng = -64.8,
    onAreaCalculated,
    onRoutePlanned,
}: LawnMapProps) {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
    const routeLayerRef = useRef<L.LayerGroup | null>(null);

    const [address, setAddress] = useState("");
    const [searching, setSearching] = useState(false);
    const [areaSqFt, setAreaSqFt] = useState<number | null>(null);
    const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
    const [deckWidth, setDeckWidth] = useState(21); // inches
    const [discharge, setDischarge] = useState<DischargeMode>("right");
    const [showRoute, setShowRoute] = useState(false);
    const [lawnPolygon, setLawnPolygon] = useState<Feature<Polygon> | null>(null);

    // ─── Initialize Map ─────────────────────────
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [initialLat, initialLng],
            zoom: 18,
            zoomControl: false,
        });

        // Satellite tiles (Esri World Imagery — free, unlimited)
        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
                attribution: "© Esri",
                maxZoom: 20,
            }
        ).addTo(map);

        // Zoom control bottom-right
        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Feature layers
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawnItemsRef.current = drawnItems;

        const routeLayer = L.layerGroup();
        map.addLayer(routeLayer);
        routeLayerRef.current = routeLayer;

        // Drawing control
        const drawControl = new L.Control.Draw({
            position: "topright",
            draw: {
                polygon: {
                    allowIntersection: false,
                    shapeOptions: {
                        color: "#aaff00",
                        weight: 2,
                        fillOpacity: 0.15,
                        fillColor: "#aaff00",
                    },
                },
                rectangle: {
                    shapeOptions: {
                        color: "#aaff00",
                        weight: 2,
                        fillOpacity: 0.15,
                        fillColor: "#aaff00",
                    },
                },
                polyline: false,
                circle: false,
                circlemarker: false,
                marker: false,
            },
            edit: {
                featureGroup: drawnItems,
                remove: true,
            },
        } as L.Control.DrawConstructorOptions);
        map.addControl(drawControl);

        // Handle polygon creation
        map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
            const event = e as L.DrawEvents.Created;
            const layer = event.layer;
            drawnItems.clearLayers();
            routeLayer.clearLayers();
            drawnItems.addLayer(layer);

            // Convert to GeoJSON and calculate area
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
        });

        // Handle polygon deletion
        map.on(L.Draw.Event.DELETED, () => {
            setAreaSqFt(null);
            setLawnPolygon(null);
            setShowRoute(false);
            setRoutePlan(null);
            routeLayer.clearLayers();
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Address Search ─────────────────────────
    const searchAddress = useCallback(async () => {
        if (!address.trim() || !mapRef.current) return;
        setSearching(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
            );
            const data = await res.json();
            if (data.length > 0) {
                const { lat, lon } = data[0];
                mapRef.current.setView([parseFloat(lat), parseFloat(lon)], 19);
            }
        } catch (err) {
            console.error("Geocoding failed:", err);
        }
        setSearching(false);
    }, [address]);

    // ─── Generate Route ─────────────────────────
    const generateRoute = useCallback(() => {
        if (!lawnPolygon || !routeLayerRef.current) return;

        const plan = planMowingRoute(lawnPolygon, [], {
            deckWidthMeters: deckWidthFromInches(deckWidth),
            discharge,
            overlapRatio: 0.93,
            headlandLaps: 2,
        });

        // Clear previous routes
        routeLayerRef.current.clearLayers();

        // Draw headlands (cyan)
        plan.headlands.forEach(h => {
            const coords = h.geometry.coordinates.map(c => [c[1], c[0]] as [number, number]);
            L.polyline(coords, {
                color: "#00e5ff",
                weight: 2,
                opacity: 0.8,
                dashArray: "6, 4",
            }).addTo(routeLayerRef.current!);
        });

        // Draw stripes (neon green with direction arrows)
        plan.stripes.forEach((s, i) => {
            const coords = s.geometry.coordinates.map(c => [c[1], c[0]] as [number, number]);
            L.polyline(coords, {
                color: i % 2 === 0 ? "#aaff00" : "#88dd00",
                weight: 3,
                opacity: 0.9,
            }).addTo(routeLayerRef.current!);

            // Add small circle at start of each stripe
            if (coords.length > 0) {
                L.circleMarker(coords[0], {
                    radius: 3,
                    color: "#aaff00",
                    fillColor: "#aaff00",
                    fillOpacity: 1,
                }).addTo(routeLayerRef.current!);
            }
        });

        setRoutePlan(plan);
        setShowRoute(true);
        onRoutePlanned?.(plan);
    }, [lawnPolygon, deckWidth, discharge, onRoutePlanned]);

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
                        <p className="text-[11px] text-muted-foreground">{(areaSqFt / 10.7639).toFixed(0)} m²</p>
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
                <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
                        <p className="text-[10px] text-muted-foreground uppercase">Distance</p>
                        <p className="text-sm font-bold text-foreground">{(routePlan.estimatedDistanceMeters).toFixed(0)}m</p>
                    </div>
                    <div className="text-center p-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
                        <p className="text-[10px] text-muted-foreground uppercase">Stripes</p>
                        <p className="text-sm font-bold text-foreground">{routePlan.stripes.length}</p>
                    </div>
                    <div className="text-center p-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
                        <p className="text-[10px] text-muted-foreground uppercase">Angle</p>
                        <p className="text-sm font-bold text-foreground">{routePlan.bestAngleDeg}°</p>
                    </div>
                </div>
            )}
        </div>
    );
}
