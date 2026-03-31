"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, PencilRuler, Plus, X } from "lucide-react";
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import "@/styles/leaflet-overrides.css";

interface SuggestionResult {
    lat: number | string;
    lng: number | string;
}

interface ZoneSummary {
    id: string;
    sqft: number;
}

interface LawnDrawModalProps {
    address: string;
    onConfirm: (sqft: number) => void;
    onClose: () => void;
}

const MONCTON_CENTER: [number, number] = [46.0878, -64.7782];

function getZoneStyle(index: number): L.PathOptions {
    const opacity = 0.12 + (index * 0.05);
    return {
        color: "#c3ff00",
        weight: 3,
        fillColor: "#c3ff00",
        fillOpacity: Math.min(opacity, 0.28),
    };
}

export default function LawnDrawModal({
    address,
    onConfirm,
    onClose,
}: LawnDrawModalProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const featureLayerRef = useRef<L.FeatureGroup | null>(null);
    const zoneLayersRef = useRef<Map<string, L.Layer>>(new Map());
    const [zones, setZones] = useState<ZoneSummary[]>([]);
    const [isLocating, setIsLocating] = useState(false);
    const [showInstructions, setShowInstructions] = useState(true);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const totalSqft = zones.reduce((sum, zone) => sum + zone.sqft, 0);

    useEffect(() => {
        if (!toastMessage) return;
        const timer = window.setTimeout(() => setToastMessage(null), 2500);
        return () => window.clearTimeout(timer);
    }, [toastMessage]);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: MONCTON_CENTER,
            zoom: 16,
            zoomControl: false,
        });

        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            { attribution: "© Esri", maxZoom: 20 },
        ).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        const featureLayer = new L.FeatureGroup().addTo(map);

        const drawControl = new L.Control.Draw({
            position: "topright",
            draw: {
                polygon: { shapeOptions: getZoneStyle(0) },
                rectangle: false,
                marker: false,
                circle: false,
                circlemarker: false,
                polyline: false,
            },
            edit: {
                featureGroup: featureLayer,
                remove: true,
            },
        } as L.Control.DrawConstructorOptions);

        map.addControl(drawControl);

        const syncZonesFromLayers = () => {
            const nextZones = Array.from(zoneLayersRef.current.entries())
                .filter(([, layer]) => featureLayer.hasLayer(layer))
                .map(([id, layer], index) => {
                    if (layer instanceof L.Polygon) {
                        layer.setStyle(getZoneStyle(index));
                    }

                    const geojson = (layer as L.Polygon).toGeoJSON() as Feature<Polygon>;
                    const sqft = Math.round(turf.area(geojson) * 10.7639);
                    return { id, sqft };
                });

            const nextIds = new Set(nextZones.map((zone) => zone.id));
            Array.from(zoneLayersRef.current.keys()).forEach((id) => {
                if (!nextIds.has(id)) {
                    zoneLayersRef.current.delete(id);
                }
            });

            setZones(nextZones);
            setShowInstructions(nextZones.length === 0);
        };

        const handleCreated: L.LeafletEventHandlerFn = (event) => {
            const drawEvent = event as L.DrawEvents.Created;

            if (zoneLayersRef.current.size >= 3) {
                setToastMessage("MAX 3 ZONES");
                return;
            }

            const zoneId = crypto.randomUUID();
            const zoneLayer = drawEvent.layer as L.Polygon;
            zoneLayer.setStyle(getZoneStyle(zoneLayersRef.current.size));
            featureLayer.addLayer(zoneLayer);
            zoneLayersRef.current.set(zoneId, zoneLayer);
            syncZonesFromLayers();
        };

        const handleEdited: L.LeafletEventHandlerFn = () => {
            syncZonesFromLayers();
        };

        const handleDeleted: L.LeafletEventHandlerFn = () => {
            syncZonesFromLayers();
        };

        const handleDrawStart: L.LeafletEventHandlerFn = () => {
            setShowInstructions(false);
        };

        map.on(L.Draw.Event.CREATED, handleCreated);
        map.on(L.Draw.Event.EDITED, handleEdited);
        map.on(L.Draw.Event.DELETED, handleDeleted);
        map.on("draw:drawstart", handleDrawStart);

        mapRef.current = map;
        featureLayerRef.current = featureLayer;

        return () => {
            map.off(L.Draw.Event.CREATED, handleCreated);
            map.off(L.Draw.Event.EDITED, handleEdited);
            map.off(L.Draw.Event.DELETED, handleDeleted);
            map.off("draw:drawstart", handleDrawStart);
            map.remove();
            mapRef.current = null;
            featureLayerRef.current = null;
            zoneLayersRef.current.clear();
        };
    }, []);

    useEffect(() => {
        let active = true;

        const locateAddress = async () => {
            if (!address.trim() || !mapRef.current) return;

            setIsLocating(true);

            try {
                const response = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(address)}`);
                const results = (await response.json()) as SuggestionResult[];
                const firstMatch = results[0];

                if (!active || !mapRef.current) return;

                if (!firstMatch) {
                    mapRef.current.flyTo(MONCTON_CENTER, 15, { duration: 1 });
                    setToastMessage("ADDRESS NOT FOUND — pan manually");
                    return;
                }

                const lat = Number(firstMatch.lat);
                const lng = Number(firstMatch.lng);

                if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    mapRef.current.flyTo(MONCTON_CENTER, 15, { duration: 1 });
                    setToastMessage("ADDRESS NOT FOUND — pan manually");
                    return;
                }

                mapRef.current.flyTo([lat, lng], 19, { duration: 1.25 });
            } catch (error) {
                console.error("Failed to geocode billing address", error);
                if (active && mapRef.current) {
                    mapRef.current.flyTo(MONCTON_CENTER, 15, { duration: 1 });
                    setToastMessage("ADDRESS NOT FOUND — pan manually");
                }
            } finally {
                if (active) {
                    setIsLocating(false);
                }
            }
        };

        void locateAddress();

        return () => {
            active = false;
        };
    }, [address]);

    const clearAllZones = () => {
        featureLayerRef.current?.clearLayers();
        zoneLayersRef.current.clear();
        setZones([]);
        setShowInstructions(true);
    };

    const removeZone = (zoneId: string) => {
        const layer = zoneLayersRef.current.get(zoneId);
        if (layer && featureLayerRef.current) {
            featureLayerRef.current.removeLayer(layer);
        }
        zoneLayersRef.current.delete(zoneId);
        setZones((current) => current.filter((zone) => zone.id !== zoneId));
        if (zoneLayersRef.current.size === 0) {
            setShowInstructions(true);
        }
    };

    const startZoneDraw = () => {
        if (!mapRef.current) return;
        if (zones.length >= 3) {
            setToastMessage("MAX 3 ZONES");
            return;
        }

        const polygonCtor = (L.Draw as unknown as {
            Polygon: new (map: L.Map, options: { shapeOptions: L.PathOptions }) => { enable: () => void };
        }).Polygon;
        new polygonCtor(mapRef.current, {
            shapeOptions: getZoneStyle(zones.length),
        }).enable();
        setShowInstructions(false);
    };

    return (
        <div className="fixed inset-0 z-[140] bg-black/95 backdrop-blur-md">
            <div ref={mapContainerRef} className="absolute inset-0" />

            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="pointer-events-auto glass-card rounded-2xl border border-white/10 bg-black/70 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary/80">
                            Draw Lawn Boundary
                        </p>
                        <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">
                            Draw Lawn Boundary
                        </h2>
                    </div>

                    <div className="pointer-events-auto flex flex-col items-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white transition-colors hover:border-white/25 hover:bg-white/10"
                            aria-label="Close lawn draw modal"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {zones.length > 0 && (
                            <button
                                type="button"
                                onClick={clearAllZones}
                                className="rounded-full border border-white/10 bg-black/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white"
                            >
                                ✕ Clear
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="pointer-events-none flex justify-center">
                        {showInstructions && (
                            <div className="rounded-full border border-white/10 bg-black/70 px-4 py-2 font-mono text-[11px] text-white">
                                TAP TO PLACE POINTS · CLOSE SHAPE TO CALCULATE
                            </div>
                        )}
                    </div>

                    {toastMessage && (
                        <div className="pointer-events-none flex justify-center">
                            <div className="rounded-full border border-orange-400/30 bg-black/75 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">
                                {toastMessage}
                            </div>
                        </div>
                    )}

                    <div className="pointer-events-auto flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="glass-card rounded-2xl border border-primary/20 bg-black/70 p-4">
                            <div className="flex items-center gap-2 text-primary">
                                <PencilRuler className="h-4 w-4" />
                                <span className="font-mono text-[10px] font-black uppercase tracking-[0.28em]">
                                    Calculated Area
                                </span>
                            </div>
                            <p className="mt-2 font-mono text-3xl font-black tracking-tight text-primary">
                                {totalSqft.toLocaleString()} sq ft
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={startZoneDraw}
                                    disabled={zones.length >= 3}
                                    className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-primary disabled:border-white/10 disabled:bg-white/10 disabled:text-white/35"
                                >
                                    <Plus className="mr-1 inline h-3 w-3" />
                                    Add Zone
                                </button>
                                {isLocating && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
                                        <LoaderCircle className="h-3 w-3 animate-spin" />
                                        Locating
                                    </span>
                                )}
                            </div>

                            {zones.length > 0 && (
                                <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs font-mono">
                                    {zones.map((zone, index) => (
                                        <div key={zone.id} className="flex items-center justify-between gap-3 text-white/80">
                                            <span>ZONE {index + 1}: {zone.sqft.toLocaleString()} sq ft</span>
                                            <button
                                                type="button"
                                                onClick={() => removeZone(zone.id)}
                                                className="text-white/55 transition-colors hover:text-white"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between border-t border-primary/20 pt-2 font-black text-primary">
                                        <span>TOTAL:</span>
                                        <span>{totalSqft.toLocaleString()} sq ft</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => onConfirm(totalSqft)}
                            disabled={totalSqft <= 0}
                            className="glass-card sticky bottom-0 flex h-14 items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary px-6 text-sm font-black uppercase tracking-[0.24em] text-black shadow-[0_0_30px_rgba(195,255,0,0.25)] transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Confirm Area
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
