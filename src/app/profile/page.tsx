"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { UserCircle, MapPin, Search, Wrench, Save, CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";
import type { Feature, Polygon } from "geojson";

const ProfileLawnMap = dynamic(() => import("@/components/ProfileLawnMap"), { ssr: false });

export default function ProfilePage() {
    const {
        userName, homeAddress, homeLat, homeLng, homeLawnBoundary, homeObstacles,
        updateProfile, saveHomeBoundary, equipment
    } = useStore();

    const [nameInput, setNameInput] = useState(userName);
    const [addressInput, setAddressInput] = useState(homeAddress);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [savedCoords, setSavedCoords] = useState<{ lat: number, lng: number } | null>(
        homeLat && homeLng ? { lat: homeLat, lng: homeLng } : null
    );
    const [savedStatus, setSavedStatus] = useState<string | null>(null);

    const handleSaveProfile = () => {
        updateProfile(nameInput, addressInput, savedCoords?.lat, savedCoords?.lng);
        setSavedStatus("Profile basic details saved.");
        setTimeout(() => setSavedStatus(null), 3000);
    };

    const handleGeocode = async () => {
        if (!addressInput.trim()) return;
        setIsGeocoding(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressInput)}&format=json&limit=1`);
            const data = await res.json();
            if (data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                setSavedCoords({ lat, lng });
                updateProfile(nameInput, addressInput, lat, lng);
                setSavedStatus("Address located and saved.");
                setTimeout(() => setSavedStatus(null), 3000);
            }
        } catch (err) {
            console.error("Geocoding failed:", err);
            setSavedStatus("Failed to locate address.");
            setTimeout(() => setSavedStatus(null), 3000);
        }
        setIsGeocoding(false);
    };

    const handleSaveBoundary = (lawn?: Feature<Polygon>, obstacles?: Feature<Polygon>[]) => {
        saveHomeBoundary(lawn, obstacles);
    };

    return (
        <div className="flex flex-col min-h-[100dvh] bg-black text-white px-4 pt-12 pb-[120px] max-w-2xl mx-auto custom-scrollbar">
            <header className="mb-8 relative z-10">
                <div className="flex items-center gap-3 mb-2">
                    <UserCircle className="w-8 h-8 text-primary" />
                    <h1 className="text-3xl font-black uppercase tracking-widest bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">Operator Profile</h1>
                </div>
                <p className="text-white/50 text-sm font-mono leading-relaxed">
                    Set your base layout, identity, and arsenal. Base coordinates are crucial for route optimization plotting.
                </p>
            </header>

            {/* Profile Identity */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 backdrop-blur-xl shrink-0">
                <h2 className="text-sm font-black text-white/80 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <UserCircle className="w-4 h-4 text-primary" /> Core Identity
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Operator Name</label>
                        <input
                            type="text"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            placeholder="John Doe"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Base Operations Address</label>
                        <div className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-primary opacity-70 shrink-0" />
                            <input
                                type="text"
                                value={addressInput}
                                onChange={(e) => setAddressInput(e.target.value)}
                                placeholder="123 Base Ave, City, State"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                            />
                            <button
                                onClick={handleGeocode}
                                disabled={isGeocoding}
                                className="p-3 bg-white/10 text-white rounded-xl hover:bg-primary hover:text-black transition-colors shrink-0 disabled:opacity-50"
                            >
                                <Search className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveProfile}
                        className="w-full py-3 bg-primary/10 border border-primary/30 text-primary uppercase font-black tracking-widest rounded-xl hover:bg-primary hover:text-black transition-all"
                    >
                        Save Configuration
                    </button>

                    {savedStatus && (
                        <p className="text-primary text-xs font-mono text-center mt-2 flex items-center justify-center gap-1 animate-in fade-in zoom-in">
                            <CheckCircle2 className="w-3 h-3" /> {savedStatus}
                        </p>
                    )}
                </div>
            </section>

            {/* Base Map / Testing Ground */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 backdrop-blur-xl shrink-0">
                <div className="flex flex-col mb-4">
                    <h2 className="text-sm font-black text-white/80 uppercase tracking-widest flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-emerald-400" /> Tactical Base Perimeter (Test Ground)
                    </h2>
                    <p className="text-white/40 text-xs font-mono">
                        Lock in your base operations boundaries. This serves as a test map for drawing polygons.
                    </p>
                </div>

                {savedCoords ? (
                    <div className="h-64 w-full rounded-xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/5">
                        <ProfileLawnMap
                            homeLat={savedCoords.lat}
                            homeLng={savedCoords.lng}
                            initialLawnBoundary={homeLawnBoundary}
                            initialObstacles={homeObstacles}
                            onSave={handleSaveBoundary}
                        />
                    </div>
                ) : (
                    <div className="h-48 w-full rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-white/30 text-center p-4">
                        <MapPin className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm font-bold uppercase tracking-widest">Awaiting Location</p>
                        <p className="text-xs font-mono mt-1 opacity-70">Enter and search your base address to unlock the tactical map.</p>
                    </div>
                )}
            </section>

            {/* Arsenal (Equipment) Summary */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 backdrop-blur-xl shrink-0">
                <h2 className="text-sm font-black text-white/80 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-orange-400" /> Arsenal (Equipment Status)
                </h2>

                {equipment && equipment.length > 0 ? (
                    <div className="space-y-3">
                        {equipment.map(eq => (
                            <div key={eq.id} className="bg-black/40 border border-white/5 rounded-xl p-4 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-white text-sm">{eq.name}</div>
                                    <div className="text-[10px] text-white/50 uppercase tracking-wider font-mono mt-1">
                                        TYPE: {eq.type} | {eq.currentHours} HOURS
                                    </div>
                                </div>
                                <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white/10 text-white/70`}>
                                    ACTIVE
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 text-white/30 text-xs font-mono">
                        No hardware registered in the arsenal.
                    </div>
                )}
            </section>

        </div>
    );
}
