"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Feature, Polygon } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "@/styles/leaflet-overrides.css";
import "leaflet-draw";

// ─── Custom Icons ───────────────────────────────────────────────
const homeIcon = L.divIcon({
    className: "custom-leaflet-icon",
    html: `
        <div class="relative flex items-center justify-center w-8 h-8">
            <div class="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping"></div>
            <div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center relative z-10 text-white shadow-black/50">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
        </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
});

const createStopIcon = (index: number) => L.divIcon({
    className: "custom-leaflet-icon",
    html: `
        <div class="relative flex items-center justify-center w-8 h-8">
            <div class="absolute inset-0 rounded-full bg-primary/20 backdrop-blur-sm"></div>
            <div class="w-7 h-7 rounded-full bg-primary border-2 border-black shadow-lg shadow-black flex items-center justify-center relative z-10 text-black font-extrabold text-sm">
                ${index}
            </div>
        </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
});


interface NominatimResult {
    lat: string;
    lon: string;
    type?: string;
    class?: string;
}

// ─── Component ──────────────────────────────────
export default function UnifiedGameMap() {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);

    // Global Layers
    const lawnLayerRef = useRef<L.FeatureGroup | null>(null);
    const obstacleLayerRef = useRef<L.FeatureGroup | null>(null);
    const routeLayerRef = useRef<L.LayerGroup | null>(null);
    const macroRouteLayerRef = useRef<L.LayerGroup | null>(null); // For daily route path

    const drawControlRef = useRef<L.Control.Draw | null>(null);

    // Draw state
    const [drawMode, setDrawMode] = useState<"lawn" | "obstacle">("lawn");
    const [lawnPolygon, setLawnPolygon] = useState<Feature<Polygon> | null>(null);
    const [obstacles, setObstacles] = useState<Feature<Polygon>[]>([]);

    const {
        clients,
        homeLat, homeLng,
        activeRouteStops, currentRouteStopIndex,
        activeMowSessionId
    } = useStore();

    // ─── Initialize Map ─────────────────────────
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: homeLat && homeLng ? [homeLat, homeLng] : [46.1, -64.8],
            zoom: 18,
            zoomControl: false,
        });

        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { attribution: "© Esri", maxZoom: 20 }
        ).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        const lawnLayer = new L.FeatureGroup().addTo(map);
        lawnLayerRef.current = lawnLayer;

        const obstacleLayer = new L.FeatureGroup().addTo(map);
        obstacleLayerRef.current = obstacleLayer;

        const routeLayer = L.layerGroup().addTo(map);
        routeLayerRef.current = routeLayer;

        const macroRouteLayer = L.layerGroup().addTo(map);
        macroRouteLayerRef.current = macroRouteLayer;

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [homeLat, homeLng]);

    // ─── Update Draw Control When Mode Changes ──
    // Enables drawing *only* when we are NOT in active drive/mow mode
    const isEditingMode = !activeRouteStops || activeRouteStops.length === 0;

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (!isEditingMode) {
            if (drawControlRef.current) map.removeControl(drawControlRef.current);
            return; // Turn off drawing when navigating
        }

        if (drawControlRef.current) map.removeControl(drawControlRef.current);
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
                    shapeOptions: { color, weight: 2, fillOpacity: isLawn ? 0.05 : 0.3, fillColor },
                },
                rectangle: {
                    shapeOptions: { color, weight: 2, fillOpacity: isLawn ? 0.05 : 0.3, fillColor },
                },
                polyline: false, circle: false, circlemarker: false, marker: false,
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
                lawnLayerRef.current!.clearLayers();
                routeLayerRef.current!.clearLayers();
                lawnLayerRef.current!.addLayer(layer);
                const geojson = (layer as L.Polygon).toGeoJSON();
                if (geojson.geometry.type === "Polygon") {
                    setLawnPolygon(geojson as Feature<Polygon>);
                }
            } else {
                obstacleLayerRef.current!.addLayer(layer);
                const geojson = (layer as L.Polygon).toGeoJSON();
                if (geojson.geometry.type === "Polygon") {
                    setObstacles(prev => [...prev, geojson as Feature<Polygon>]);
                }
            }
        });

        // Handle deletion
        map.on(L.Draw.Event.DELETED, () => {
            if (isLawn) {
                setLawnPolygon(null);
                routeLayerRef.current!.clearLayers();
            } else {
                const remaining: Feature<Polygon>[] = [];
                obstacleLayerRef.current!.eachLayer((layer) => {
                    const geojson = (layer as L.Polygon).toGeoJSON();
                    if (geojson.geometry.type === "Polygon") remaining.push(geojson as Feature<Polygon>);
                });
                setObstacles(remaining);
            }
        });
    }, [drawMode, isEditingMode]);

    // ─── Cinematic Camera Transitions ─────────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        lawnLayerRef.current?.clearLayers();
        obstacleLayerRef.current?.clearLayers();
        macroRouteLayerRef.current?.clearLayers();
        routeLayerRef.current?.clearLayers();

        // SCENARIO 1: We are actively mowing a specific property (Micro view)
        if (activeMowSessionId && activeRouteStops && currentRouteStopIndex < activeRouteStops.length) {
            const currentStop = activeRouteStops[currentRouteStopIndex];
            const client = clients.find(c => c.id === currentStop.clientId);

            if (client && client.lat && client.lng) {
                // Fly in directly to the property
                map.flyTo([client.lat, client.lng], 20, { duration: 1.5, animate: true });

                // Redraw their stored GeoJSON geometries beautifully onto the map
                if (client.lawnBoundary) {
                    L.geoJSON(client.lawnBoundary, {
                        style: { color: "#aaff00", weight: 2, fillOpacity: 0.1, fillColor: "#aaff00" }
                    }).addTo(lawnLayerRef.current!);
                }

                if (client.obstacles && client.obstacles.length > 0) {
                    client.obstacles.forEach(obs => {
                        L.geoJSON(obs, {
                            style: { color: "#ff4444", weight: 2, fillOpacity: 0.3, fillColor: "#ff4444" }
                        }).addTo(obstacleLayerRef.current!);
                    });
                }
            }
        }
        // SCENARIO 2: We are in Drive Mode navigating between stops (Macro view)
        else if (activeRouteStops && activeRouteStops.length > 0 && homeLat && homeLng) {
            const allCoords: [number, number][] = [
                [homeLat, homeLng],
                ...activeRouteStops.map(s => [s.lat, s.lng] as [number, number]),
                [homeLat, homeLng]
            ];

            const bounds = L.latLngBounds(allCoords);
            map.flyToBounds(bounds, { padding: [100, 100], duration: 1.5, animate: true });

            L.polyline(allCoords, {
                color: 'hsl(var(--primary))',
                weight: 4,
                opacity: 0.8,
                lineCap: 'round',
                dashArray: '8, 8'
            }).addTo(macroRouteLayerRef.current!);

            L.marker([homeLat, homeLng], { icon: homeIcon }).addTo(macroRouteLayerRef.current!);

            activeRouteStops.forEach((stop, idx) => {
                L.marker([stop.lat, stop.lng], { icon: createStopIcon(idx + 1) }).addTo(macroRouteLayerRef.current!);
            });
        }
    }, [activeRouteStops, currentRouteStopIndex, activeMowSessionId, clients, homeLat, homeLng]);

    return <div ref={mapContainerRef} className="absolute inset-0 z-0 w-full h-full bg-[#0a0f0d]" />;
}
