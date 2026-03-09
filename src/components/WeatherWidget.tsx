"use client";

import { useEffect, useState } from "react";
import { getFullWeatherData, type FullWeatherData } from "@/lib/weather-api";
import { Cloud, Droplets, Wind, Sun, Loader2, CloudRain, CloudLightning, CloudSnow, CloudFog, CloudSun, Moon } from "lucide-react";

interface WeatherWidgetProps {
    lat: number;
    lng: number;
}

// Module-level cache so all renders share one fetch per session
let cachedWeather: FullWeatherData | null = null;
let cacheKey = "";

function getWmoCondition(code: number, isDay: boolean) {
    // Basic mapping based on Open-Meteo WMO docs
    if (code === 0) return { label: "Clear sky", Icon: isDay ? Sun : Moon };
    if (code === 1 || code === 2) return { label: isDay ? "Partly cloudy" : "Mostly clear", Icon: isDay ? CloudSun : Cloud };
    if (code === 3) return { label: "Overcast", Icon: Cloud };
    if (code >= 45 && code <= 48) return { label: "Fog", Icon: CloudFog };
    if (code >= 51 && code <= 67) return { label: "Rain", Icon: CloudRain };
    if (code >= 71 && code <= 77) return { label: "Snow", Icon: CloudSnow };
    if (code >= 80 && code <= 82) return { label: "Rain showers", Icon: CloudRain };
    if (code >= 85 && code <= 86) return { label: "Snow showers", Icon: CloudSnow };
    if (code >= 95) return { label: "Thunderstorms", Icon: CloudLightning };

    return { label: "Unknown", Icon: isDay ? Sun : Moon };
}

export function WeatherWidget({ lat, lng }: WeatherWidgetProps) {
    const [weather, setWeather] = useState<FullWeatherData | null>(cachedWeather);
    const [loading, setLoading] = useState(!cachedWeather);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!lat || !lng) return;
        const key = `${lat},${lng}`;

        if (cachedWeather && cacheKey === key) {
            setWeather(cachedWeather);
            setLoading(false);
            return;
        }

        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                const data = await getFullWeatherData(lat, lng);
                if (cancelled) return;
                if (data) {
                    cachedWeather = data;
                    cacheKey = key;
                    setWeather(data);
                    setError(null);
                } else {
                    setError("Weather unavailable");
                }
            } catch {
                if (!cancelled) setError("Failed to load weather");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [lat, lng]);

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-center h-[120px] text-white/50 space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs font-medium uppercase tracking-widest">Fetching Conditions</span>
            </div>
        );
    }

    if (error || !weather) {
        return (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-center h-[120px] text-white/50 text-xs font-medium uppercase tracking-widest">
                {error || "Weather Unavailable"}
            </div>
        );
    }

    const { current, forecastPrecipitation, forecastDayLabels, totalPastRainMm, todayHighLow } = weather;
    const isDay = current.is_day === 1;
    const humidity = current.relative_humidity_2m ?? 50;

    const condition = getWmoCondition(current.weathercode, isDay);
    const WeatherIcon = condition.Icon;

    // Scale for rain bars — cap at 25mm for visual clarity
    const maxBarMm = Math.max(25, ...forecastPrecipitation);

    const todayRainMm = forecastPrecipitation[0] || 0;
    const isThunderstorm = current.weathercode >= 95;

    let mowStatus = "GOOD TO MOW";
    let statusClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (todayRainMm > 5 || isThunderstorm) {
        mowStatus = "DELAY REC.";
        statusClass = "bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)]";
    } else if (todayRainMm >= 1 || humidity > 85 || current.weathercode >= 51) {
        mowStatus = "CAUTION";
        statusClass = "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]";
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_15px_rgba(0,0,0,0.2)] overflow-hidden relative">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${statusClass.split(' ')[0]}`} />

            {/* Top row: current conditions & decision badge */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 pl-5">
                <div className="flex items-center gap-3 pl-2">
                    <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                        <WeatherIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-xl font-bold text-white leading-none">{Math.round(current.temperature)}°C</h3>
                            <div className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded border ${statusClass}`}>
                                {mowStatus}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-white/50 font-medium">{condition.label}</p>
                            {todayHighLow && (
                                <span className="text-[9px] text-white/40 font-bold">
                                    {Math.round(todayHighLow.high)}° / {Math.round(todayHighLow.low)}°
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 text-right pr-1">
                    <div>
                        <p className="text-[9px] text-white/40 uppercase font-black tracking-widest mb-[1px] flex items-center justify-end gap-1">
                            <Droplets className="w-2.5 h-2.5 text-blue-400" /> HUM
                        </p>
                        <p className="font-bold text-sm text-white leading-none">{humidity}%</p>
                    </div>
                    <div>
                        <p className="text-[9px] text-white/40 uppercase font-black tracking-widest mb-[1px] flex items-center justify-end gap-1">
                            <Wind className="w-2.5 h-2.5 text-teal-400" /> WIND
                        </p>
                        <p className="font-bold text-sm text-white leading-none">
                            {Math.round(current.windspeed)} <span className="text-[9px] text-white/40">km</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Bottom row: rain summary */}
            <div className="px-5 pb-3 pl-6 border-t border-white/5 pt-2 flex items-end gap-4">
                {/* Past 5-day total */}
                <div className="shrink-0">
                    <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold mb-1 flex items-center gap-1">
                        <CloudRain className="w-3 h-3 text-blue-400/60" /> Past 5d
                    </p>
                    <p className="text-lg font-bold text-white leading-none">
                        {totalPastRainMm.toFixed(1)}
                        <span className="text-[10px] text-white/40 font-normal ml-0.5">mm</span>
                    </p>
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-white/10 shrink-0" />

                {/* Forecast rain bars */}
                <div className="flex-1">
                    <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold mb-2">3-Day Forecast</p>
                    <div className="flex items-end gap-1.5">
                        {forecastPrecipitation.slice(0, 4).map((mm, i) => {
                            const heightPct = maxBarMm > 0 ? (mm / maxBarMm) * 100 : 0;
                            const minH = 4;
                            const barH = Math.max(minH, heightPct * 0.36); // max ~36px
                            const isToday = i === 0;
                            return (
                                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                                    <span className="text-[8px] text-white/40 font-bold">
                                        {mm > 0 ? `${mm.toFixed(1)}` : "—"}
                                    </span>
                                    <div className="w-full flex items-end justify-center">
                                        <div
                                            className={`w-full rounded-sm transition-all ${mm > 10
                                                ? "bg-blue-400/70"
                                                : mm > 2
                                                    ? "bg-blue-400/40"
                                                    : "bg-white/10"
                                                } ${isToday ? "ring-1 ring-primary/40" : ""}`}
                                            style={{ height: `${barH}px` }}
                                        />
                                    </div>
                                    <span className={`text-[8px] font-bold uppercase tracking-wide ${isToday ? "text-primary/70" : "text-white/30"}`}>
                                        {forecastDayLabels[i] ?? ""}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
