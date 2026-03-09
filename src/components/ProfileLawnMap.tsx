"use client";

import { useEffect, useRef, useState } from "react";
import type { Feature, Polygon } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "@/styles/leaflet-overrides.css";
import "leaflet-draw";

interface ProfileLawnMapProps {
    homeLat: number;
    homeLng: number;
    initialLawnBoundary?: Feature<Polygon>;
    initialObstacles?: Feature<Polygon>[];
    onSave: (lawnBoundary?: Feature<Polygon>, obstacles?: Feature<Polygon>[]) => void;
    onLocationChange?: (lat: number, lng: number) => void;
}

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

export default function ProfileLawnMap({ homeLat, homeLng, initialLawnBoundary, initialObstacles, onSave, onLocationChange }: ProfileLawnMapProps) {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const drawControlRef = useRef<L.Control.Draw | null>(null);

    const lawnLayerRef = useRef<L.FeatureGroup | null>(null);
    const obstacleLayerRef = useRef<L.FeatureGroup | null>(null);

    const [drawMode, setDrawMode] = useState<"lawn" | "obstacle">("lawn");

    const [currentLawn, setCurrentLawn] = useState<Feature<Polygon> | undefined>(initialLawnBoundary);
    const [currentObstacles, setCurrentObstacles] = useState<Feature<Polygon>[]>(initialObstacles || []);

    // Init map
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [homeLat, homeLng],
            zoom: 20,
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

        // Draw initial data
        if (initialLawnBoundary) {
            L.geoJSON(initialLawnBoundary, {
                style: { color: "#aaff00", weight: 2, fillOpacity: 0.1, fillColor: "#aaff00" }
            }).addTo(lawnLayer);
        }

        if (initialObstacles && initialObstacles.length > 0) {
            initialObstacles.forEach(obs => {
                L.geoJSON(obs, {
                    style: { color: "#ff4444", weight: 2, fillOpacity: 0.3, fillColor: "#ff4444" }
                }).addTo(obstacleLayer);
            });
        }

        const marker = L.marker([homeLat, homeLng], { icon: homeIcon, draggable: true }).addTo(map);
        marker.on("dragend", (e) => {
            const coords = e.target.getLatLng();
            if (onLocationChange) {
                onLocationChange(coords.lat, coords.lng);
            }
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [homeLat, homeLng]);

    // Setup draw control
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (drawControlRef.current) map.removeControl(drawControlRef.current);

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

        // Cleanup before re-attaching listeners
        map.off(L.Draw.Event.CREATED);
        map.off(L.Draw.Event.DELETED);
        map.off(L.Draw.Event.EDITED);

        // Handle creation
        map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
            const event = e as L.DrawEvents.Created;
            const layer = event.layer;

            if (isLawn) {
                lawnLayerRef.current!.clearLayers();
                lawnLayerRef.current!.addLayer(layer);
                const geojson = (layer as L.Polygon).toGeoJSON();
                if (geojson.geometry.type === "Polygon") {
                    setCurrentLawn(geojson as Feature<Polygon>);
                }
            } else {
                obstacleLayerRef.current!.addLayer(layer);
                const geojson = (layer as L.Polygon).toGeoJSON();
                if (geojson.geometry.type === "Polygon") {
                    setCurrentObstacles(prev => [...prev, geojson as Feature<Polygon>]);
                }
            }
        });

        // Handle deletion
        map.on(L.Draw.Event.DELETED, () => {
            if (isLawn) {
                setCurrentLawn(undefined);
            } else {
                const remaining: Feature<Polygon>[] = [];
                obstacleLayerRef.current!.eachLayer((layer) => {
                    const geojson = (layer as L.Polygon).toGeoJSON();
                    if (geojson.geometry.type === "Polygon") remaining.push(geojson as Feature<Polygon>);
                });
                setCurrentObstacles(remaining);
            }
        });

    }, [drawMode]);

    // Save changes when they occur
    useEffect(() => {
        onSave(currentLawn, currentObstacles);
    }, [currentLawn, currentObstacles]);

    return (
        <div className="relative w-full h-full rounded-xl overflow-hidden shadow-xl border border-white/10">
            <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-[#0a0f0d]" />
            <div className="absolute top-4 left-4 z-[400] bg-black/80 backdrop-blur-md p-1.5 rounded-xl border border-white/10 flex gap-2">
                <button
                    onClick={() => setDrawMode("lawn")}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-colors ${drawMode === "lawn" ? "bg-primary text-black" : "text-white/50 hover:text-white"}`}
                >
                    Boundary
                </button>
                <button
                    onClick={() => setDrawMode("obstacle")}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-colors ${drawMode === "obstacle" ? "bg-red-500 text-white" : "text-white/50 hover:text-white"}`}
                >
                    Obstacles
                </button>
            </div>
        </div>
    );
}
