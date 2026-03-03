"use client";

import { useEffect, useState } from "react";
import { getCurrentWeather, WeatherData } from "@/lib/weather-api";
import { Card, CardContent } from "@/components/ui/card";
import { Cloud, Droplets, Wind, Sun, Loader2 } from "lucide-react";

interface WeatherWidgetProps {
    lat: number;
    lng: number;
}

export function WeatherWidget({ lat, lng }: WeatherWidgetProps) {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadWeather() {
            try {
                setLoading(true);
                const data = await getCurrentWeather(lat, lng);
                setWeather(data);
                setError(null);
            } catch (err) {
                console.error("Failed to load weather:", err);
                setError("Failed to load weather data");
            } finally {
                setLoading(false);
            }
        }

        if (lat && lng) {
            loadWeather();
        }
    }, [lat, lng]);

    if (loading) {
        return (
            <Card className="border-white/10 bg-[#0a0f0d] rounded-[1.5rem] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] w-full overflow-hidden">
                <CardContent className="p-4 flex flex-col items-center justify-center h-[120px] text-white/50 space-y-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-xs font-medium uppercase tracking-widest">Fetching Conditions</span>
                </CardContent>
            </Card>
        );
    }

    if (error || !weather) {
        return (
            <Card className="border-white/10 bg-[#0a0f0d] rounded-[1.5rem] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] w-full overflow-hidden">
                <CardContent className="p-4 flex items-center justify-center h-[120px] text-white/50 text-xs font-medium uppercase tracking-widest">
                    {error || "Weather Unavailable"}
                </CardContent>
            </Card>
        );
    }

    const temperature = weather.temperature;
    const windSpeed = weather.windspeed;
    const humidity = weather.relative_humidity_2m ?? 50;
    const isDay = weather.is_day === 1;

    return (
        <div className="glass-card rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-primary mb-8 bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[0_0_15px_rgba(195,255,0,0.1)]">
            <div className="flex items-center gap-4">
                <div className="bg-primary/20 p-3 rounded-xl border border-primary/30 shadow-[0_4px_12px_rgba(195,255,0,0.2)]">
                    {isDay ? <Sun className="w-8 h-8 text-primary drop-shadow-md" /> : <Cloud className="w-8 h-8 text-primary drop-shadow-md" />}
                </div>
                <div>
                    <h3 className="text-2xl font-bold font-heading text-white">{Math.round(temperature)}°C</h3>
                    <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold mt-0.5">Current Conditions</p>
                </div>
            </div>

            <div className="flex gap-6 text-right">
                <div>
                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1 flex items-center justify-end gap-1"><Droplets className="w-3 h-3 text-blue-400" /> Humidity</p>
                    <p className="font-bold text-sm text-white">{humidity}%</p>
                </div>
                <div>
                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1 flex items-center justify-end gap-1"><Wind className="w-3 h-3 text-teal-400" /> Wind</p>
                    <p className="font-bold text-sm text-white">{Math.round(windSpeed)} <span className="text-[10px] text-white/40 uppercase">KM/H</span></p>
                </div>
            </div>
        </div>
    );
}
