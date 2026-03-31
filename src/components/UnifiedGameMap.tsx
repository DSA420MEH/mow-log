"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, memo } from "react";
import { useStore } from "@/lib/store";
import { generateMowingPath, calculateMowingStats } from "@/lib/lawn-intelligence";
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
            <div class="absolute inset-0 rounded-full bg-emerald-500/20 blur-md animate-pulse"></div>
            <div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white/80 shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center justify-center relative z-10 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
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
            <div class="absolute inset-0 rounded-full bg-primary/30 blur-sm animate-pulse"></div>
            <div class="w-7 h-7 rounded-full bg-primary border-2 border-black/80 shadow-[0_0_12px_rgba(195,255,0,0.5)] flex items-center justify-center relative z-10 text-black font-black text-xs">
                ${index}
            </div>
        </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
});

const createClientIcon = (name: string, isSelected: boolean = false) => L.divIcon({
    className: "custom-leaflet-icon",
    html: `
        <div class="relative flex items-center justify-center w-8 h-8">
            <div class="absolute inset-0 rounded-full ${isSelected ? 'bg-primary/40' : 'bg-white/10'} blur-sm ${isSelected ? 'animate-pulse' : ''}"></div>
            <div class="w-6 h-6 rounded-full ${isSelected ? 'bg-primary text-black' : 'bg-zinc-800 text-white'} border-2 ${isSelected ? 'border-black/50' : 'border-white/20'} shadow-lg flex items-center justify-center relative z-10 font-bold text-[10px] uppercase">
                ${name.charAt(0) || '?'}
            </div>
        </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
});

const getJitteredCoords = (lat: any, lng: any, index: number): [number, number] => {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (isNaN(nLat) || isNaN(nLng)) return [0, 0];
    if (index === 0) return [nLat, nLng];
    const angle = (index * 137.5) * (Math.PI / 180); 
    const r = 0.00003 * Math.sqrt(index);
    return [nLat + r * Math.sin(angle), nLng + r * Math.cos(angle)];
};

// ─── STYLING HELPERS ────────────────────────────
const BASE_BOUNDARY_STYLE: L.PathOptions = {
    weight: 3,
    fillOpacity: 0.15,
    lineCap: 'round',
    lineJoin: 'round'
};

const getBoundaryStyle = (type: 'lawn' | 'obstacle', isSelected: boolean): L.PathOptions => {
    if (type === 'lawn') {
        return {
            ...BASE_BOUNDARY_STYLE,
            color: isSelected ? "#aaff00" : "#aaff0099",
            fillColor: "#aaff00",
            dashArray: isSelected ? undefined : "5, 10"
        };
    } else {
        return {
            ...BASE_BOUNDARY_STYLE,
            color: isSelected ? "#ff4444" : "#ff444499",
            fillColor: "#ff4444",
            fillOpacity: 0.3,
            dashArray: isSelected ? undefined : "2, 5"
        };
    }
};

// ─── Props ──────────────────────────────────────
export interface UnifiedGameMapRef {
    flyToClient: (clientId: string) => void;
    flyToCoords: (lat: number, lng: number, zoom?: number) => void;
    generateMowingPattern: (clientId: string) => void;
}

interface UnifiedGameMapProps {
    editingClientId?: string | null;
    drawMode?: "lawn" | "obstacle";
    onSaveBoundaries?: (clientId: string, lawnBoundary: Feature<Polygon> | null, obstacles: Feature<Polygon>[]) => void;
    onDataChange?: (lawnBoundary: Feature<Polygon> | null, obstacles: Feature<Polygon>[]) => void;
    onPinMoved?: (clientId: string, lat: number, lng: number) => void;
    onClientClick?: (clientId: string) => void;
    onStatsUpdate?: (stats: any) => void;
    onViewChange?: (center: { lat: number, lng: number }, zoom: number) => void;
    initialView?: { lat: number, lng: number, zoom: number };
}

// ─── Component ──────────────────────────────────
const UnifiedGameMap = memo(forwardRef<UnifiedGameMapRef, UnifiedGameMapProps>(({
    editingClientId = null,
    drawMode = "lawn",
    onSaveBoundaries,
    onDataChange,
    onPinMoved,
    onClientClick,
    onStatsUpdate,
    onViewChange,
    initialView
}, ref) => {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);

    // Global Layers
    const lawnLayerRef = useRef<L.FeatureGroup | null>(null);
    const obstacleLayerRef = useRef<L.FeatureGroup | null>(null);
    const routeLayerRef = useRef<L.LayerGroup | null>(null);
    const macroRouteLayerRef = useRef<L.LayerGroup | null>(null);

    const drawControlRef = useRef<L.Control.Draw | null>(null);
    const editingMarkerRef = useRef<L.Marker | null>(null);
    const allClientMarkersRef = useRef<Map<string, L.Marker>>(new Map());

    // Internal state for real-time area calculation
    const [lawnPolygon, setLawnPolygon] = useState<Feature<Polygon> | null>(null);
    const [obstacles, setObstacles] = useState<Feature<Polygon>[]>([]);
    const [mapReady, setMapReady] = useState(false);

    const {
        clients,
        homeLat, homeLng,
        activeRouteStops, currentRouteStopIndex,
        activeMowSessionId
    } = useStore();

    // Critical: onViewChangeRef to keep event handlers fresh without re-binding
    const onViewChangeRef = useRef(onViewChange);
    useEffect(() => {
        onViewChangeRef.current = onViewChange;
    }, [onViewChange]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        flyToClient: (clientId: string) => {
            const client = clients.find(c => c.id === clientId);
            if (client?.lat && client?.lng && mapRef.current) {
                mapRef.current.flyTo([client.lat, client.lng], 20, { duration: 1.5 });
            }
        },
        flyToCoords: (lat: number, lng: number, zoom = 16) => {
            if (mapRef.current) {
                mapRef.current.flyTo([lat, lng], zoom, { duration: 1.5 });
            }
        },
        generateMowingPattern: (clientId: string) => {
            const client = clients.find(c => c.id === clientId);
            if (!client?.lawnBoundary || !routeLayerRef.current || !mapRef.current) return;

            routeLayerRef.current.clearLayers();
            const mowerInches = parseInt(client.mowerSize || "54");
            const pattern = generateMowingPath(
                client.lawnBoundary, 
                client.obstacles || [], 
                mowerInches,
                client.mowerType || 'standard'
            );
            
            L.geoJSON(pattern, {
                style: {
                    color: "#aaff00",
                    weight: Math.max(1, mowerInches / 12),
                    opacity: 0.8,
                    dashArray: "4, 8"
                }
            }).addTo(routeLayerRef.current);
            
            const stats = calculateMowingStats(pattern, 3.5);
            if (onStatsUpdate) onStatsUpdate(stats);
        }
    }), [clients, onStatsUpdate]);

    // Notify parent on data change
    useEffect(() => {
        if (onDataChange) onDataChange(lawnPolygon, obstacles);
    }, [lawnPolygon, obstacles, onDataChange]);

    const hasInitializedView = useRef(false);
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        // Determine center
        const centerCoords: [number, number] = initialView 
            ? [initialView.lat, initialView.lng] 
            : (homeLat && homeLng ? [homeLat, homeLng] : (clients.length > 0 && clients[0].lat && clients[0].lng ? [clients[0].lat, clients[0].lng] : [45.4215, -75.6972]));
        const zoom = initialView?.zoom || 13;

        const map = L.map(mapContainerRef.current, {
            center: centerCoords,
            zoom: zoom,
            zoomControl: false,
        });

        hasInitializedView.current = true;

        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { attribution: "© Esri", maxZoom: 20 }
        ).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        macroRouteLayerRef.current = L.layerGroup().addTo(map);
        lawnLayerRef.current = new L.FeatureGroup().addTo(map);
        obstacleLayerRef.current = new L.FeatureGroup().addTo(map);
        routeLayerRef.current = L.layerGroup().addTo(map);

        map.on('moveend', () => {
            if (onViewChangeRef.current) {
                const center = map.getCenter();
                onViewChangeRef.current({ lat: center.lat, lng: center.lng }, map.getZoom());
            }
        });

        mapRef.current = map;
        setMapReady(true);

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []); // One-time initialization

    // Separate logic for flying to initial view if it changes from outside AND map is ready
    useEffect(() => {
        if (mapRef.current && initialView && !hasInitializedView.current) {
            mapRef.current.setView([initialView.lat, initialView.lng], initialView.zoom);
            hasInitializedView.current = true;
        }
    }, [initialView]);

    // ─── Draw Control logic (Simplified baseline-style) ──────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const isEditingMode = !!editingClientId || (!activeRouteStops || activeRouteStops.length === 0);
        
        if (drawControlRef.current) map.removeControl(drawControlRef.current);
        if (!isEditingMode) return;

        const isLawn = drawMode === "lawn";
        const color = isLawn ? "#aaff00" : "#ff4444";
        const editGroup = isLawn ? lawnLayerRef.current! : obstacleLayerRef.current!;

        const drawControl = new L.Control.Draw({
            position: "topright",
            draw: {
                polygon: { shapeOptions: { color, weight: 2, fillOpacity: isLawn ? 0.05 : 0.3 } },
                rectangle: { shapeOptions: { color, weight: 2, fillOpacity: isLawn ? 0.05 : 0.3 } },
                marker: false, circle: false, circlemarker: false, polyline: false,
            },
            edit: { featureGroup: editGroup, remove: true }
        } as any);

        map.addControl(drawControl);
        drawControlRef.current = drawControl;

        const handleCreated = (e: any) => {
            const layer = e.layer;
            if (isLawn) {
                lawnLayerRef.current!.clearLayers();
                lawnLayerRef.current!.addLayer(layer);
                setLawnPolygon(layer.toGeoJSON());
            } else {
                obstacleLayerRef.current!.addLayer(layer);
                setObstacles(prev => [...prev, layer.toGeoJSON()]);
            }
        };

        const handleDeleted = () => {
            if (isLawn) {
                setLawnPolygon(null);
            } else {
                const obsArray: Feature<Polygon>[] = [];
                obstacleLayerRef.current!.eachLayer((l: any) => obsArray.push(l.toGeoJSON()));
                setObstacles(obsArray);
            }
        };

        const handleEdited = () => {
            if (isLawn) {
                lawnLayerRef.current!.eachLayer((l: any) => setLawnPolygon(l.toGeoJSON()));
            } else {
                const obsArray: Feature<Polygon>[] = [];
                obstacleLayerRef.current!.eachLayer((l: any) => obsArray.push(l.toGeoJSON()));
                setObstacles(obsArray);
            }
        };

        map.on(L.Draw.Event.CREATED, handleCreated);
        map.on(L.Draw.Event.EDITED, handleEdited);
        map.on(L.Draw.Event.DELETED, handleDeleted);

        return () => {
            map.off(L.Draw.Event.CREATED, handleCreated);
            map.off(L.Draw.Event.EDITED, handleEdited);
            map.off(L.Draw.Event.DELETED, handleDeleted);
        };
    }, [drawMode, editingClientId, activeRouteStops]);

    // ─── Scenario Logic (Optimized for flicker) ───────────
    const lastStateRef = useRef<string>("");
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;

        // Create a signature of the current state to avoid redundant updates
        const currentStateSignature = JSON.stringify({
            editingClientId,
            activeMowSessionId,
            currentStopId: activeRouteStops?.[currentRouteStopIndex]?.clientId,
            clientCount: clients.length,
            home: `${homeLat},${homeLng}`
        });

        if (lastStateRef.current === currentStateSignature) return;
        lastStateRef.current = currentStateSignature;

        // Reset layers
        lawnLayerRef.current?.clearLayers();
        obstacleLayerRef.current?.clearLayers();
        macroRouteLayerRef.current?.clearLayers();
        routeLayerRef.current?.clearLayers();

        // 1. Client Editing Mode
        if (editingClientId) {
            const client = clients.find(c => c.id === editingClientId);
            if (client && client.lat && client.lng) {
                // Initialize internal state for real-time area calculation
                if (client.lawnBoundary && !lawnPolygon) setLawnPolygon(client.lawnBoundary);
                if (client.obstacles && obstacles.length === 0) setObstacles(client.obstacles);

                // Marker
                if (editingMarkerRef.current) editingMarkerRef.current.remove();
                editingMarkerRef.current = L.marker([client.lat, client.lng], { 
                    draggable: true,
                    icon: createClientIcon(client.name, true)
                })
                    .bindTooltip(client.name, { permanent: false, direction: 'top', offset: [0, -10] })
                    .on('dragend', (e) => onPinMoved?.(client.id, e.target.getLatLng().lat, e.target.getLatLng().lng))
    .addTo(macroRouteLayerRef.current!);
                
                // Boundaries
                if (client.lawnBoundary) L.geoJSON(client.lawnBoundary, { style: getBoundaryStyle('lawn', true) }).addTo(lawnLayerRef.current!);
                client.obstacles?.forEach(o => L.geoJSON(o, { style: getBoundaryStyle('obstacle', true) }).addTo(obstacleLayerRef.current!));
            }
        } 
        // 2. Mowing Mode
        else if (activeMowSessionId && activeRouteStops) {
            const stop = activeRouteStops[currentRouteStopIndex];
            const client = clients.find(c => c.id === stop?.clientId);
            if (client) {
                if (client.lawnBoundary) L.geoJSON(client.lawnBoundary, { style: getBoundaryStyle('lawn', true) }).addTo(lawnLayerRef.current!);
                client.obstacles?.forEach(o => L.geoJSON(o, { style: getBoundaryStyle('obstacle', true) }).addTo(obstacleLayerRef.current!));
            }
        }
        // 3. Drive Mode (Daily Route)
        else if (activeRouteStops?.length) {
            // Trim to remaining route stops based on currentRouteStopIndex
            const remainingStops = activeRouteStops.slice(currentRouteStopIndex);
            
            // Draw remaining route polyline
            const coords: [number, number][] = remainingStops.map(s => [s.lat, s.lng]);
            if (currentRouteStopIndex === 0 && homeLat && homeLng) {
                coords.unshift([homeLat, homeLng]);
                L.marker([homeLat, homeLng], { icon: homeIcon }).addTo(macroRouteLayerRef.current!);
            } else if (currentRouteStopIndex > 0) {
                const prevStop = activeRouteStops[currentRouteStopIndex - 1];
                if (prevStop) {
                    coords.unshift([prevStop.lat, prevStop.lng]);
                }
            }
            L.polyline(coords, { color: '#c3ff00', dashArray: '8, 8', weight: 4, opacity: 0.8 }).addTo(macroRouteLayerRef.current!);
            
            // Render remaining markers
            remainingStops.forEach((s, i) => L.marker([s.lat, s.lng], { icon: createStopIcon(currentRouteStopIndex + i + 1) }).addTo(macroRouteLayerRef.current!));

            // Render remaining boundaries underneath
            remainingStops.forEach(stop => {
                const c = clients.find(client => client.id === stop.clientId);
                if (c && c.lawnBoundary) {
                    L.geoJSON(c.lawnBoundary, { style: getBoundaryStyle('lawn', false) }).addTo(lawnLayerRef.current!);
                }
            });
        }
        // 4. Overview
        else {
            if (homeLat && homeLng) {
                L.marker([homeLat, homeLng], { icon: homeIcon })
                    .bindTooltip("Home", { direction: 'top', offset: [0, -10] })
                    .addTo(macroRouteLayerRef.current!);
            }
            
            clients.forEach((c, i) => {
                if (c.lat && c.lng) {
                    const coords = getJitteredCoords(c.lat, c.lng, i);
                    L.marker(coords, { icon: createClientIcon(c.name) })
                        .bindTooltip(c.name, { direction: 'top', offset: [0, -10] })
                        .on('click', () => onClientClick?.(c.id))
                        .addTo(macroRouteLayerRef.current!);
                }
            });
        }
    }, [mapReady, editingClientId, activeMowSessionId, activeRouteStops, clients, homeLat, homeLng]);

    return (
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full bg-[#0a0f0d] z-0" />
    );
}));

UnifiedGameMap.displayName = "UnifiedGameMap";
export default UnifiedGameMap;
