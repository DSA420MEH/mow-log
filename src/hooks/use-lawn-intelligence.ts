"use client";

import { useState, useEffect, useMemo } from "react";
import { getFullWeatherData, type FullWeatherData } from "@/lib/weather-api";
import {
    computeMowSafety,
    estimateGrowthSinceLastCut,
    computeBestMowDays,
    type MowSafetyResult,
    type GrowthEstimate,
    type BestDayResult,
} from "@/lib/lawn-intelligence";
import { useStore } from "@/lib/store";

// Module-level cache so every consumer shares the same data
let cachedWeather: FullWeatherData | null = null;
let weatherCacheKey = "";

export interface LawnIntelligenceData {
    mowSafety: MowSafetyResult | null;
    bestDays: BestDayResult | null;
    weatherData: FullWeatherData | null;
    loading: boolean;
}

/**
 * Master hook for lawn intelligence features.
 * Fetches full weather once and derives all three calculators.
 */
export function useLawnIntelligence(lat: number, lng: number): LawnIntelligenceData {
    const [weatherData, setWeatherData] = useState<FullWeatherData | null>(cachedWeather);
    const [loading, setLoading] = useState(!cachedWeather);

    useEffect(() => {
        if (!lat || !lng) return;
        const key = `${lat},${lng}`;

        if (cachedWeather && weatherCacheKey === key) {
            setWeatherData(cachedWeather);
            setLoading(false);
            return;
        }

        let cancelled = false;

        async function fetchData() {
            try {
                setLoading(true);
                const data = await getFullWeatherData(lat, lng);
                if (cancelled) return;

                if (data) {
                    cachedWeather = data;
                    weatherCacheKey = key;
                    setWeatherData(data);
                }
            } catch (err) {
                console.error("Lawn intelligence fetch failed:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchData();
        return () => { cancelled = true; };
    }, [lat, lng]);

    const mowSafety = useMemo(() => {
        if (!weatherData) return null;
        return computeMowSafety(
            weatherData.current,
            weatherData.hourly,
            weatherData.pastPrecipitation,
        );
    }, [weatherData]);

    const bestDays = useMemo(() => {
        if (!weatherData?.daily) return null;
        return computeBestMowDays(weatherData.daily);
    }, [weatherData]);

    return { mowSafety, bestDays, weatherData, loading };
}

/**
 * Per-client growth estimate hook.
 * Uses the cached weather data from useLawnIntelligence.
 */
export function useGrowthEstimate(clientId: string): GrowthEstimate | null {
    const sessions = useStore((s) => s.sessions);

    return useMemo(() => {
        // Find last completed mow for this client
        const clientSessions = sessions
            .filter((s) => s.clientId === clientId && s.status === 'completed' && s.endTime)
            .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());

        if (clientSessions.length === 0 || !cachedWeather?.daily) return null;

        const lastMowDate = new Date(clientSessions[0].endTime!);
        const daysSinceLastCut = Math.floor(
            (Date.now() - lastMowDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastCut <= 0) return null;

        return estimateGrowthSinceLastCut(
            daysSinceLastCut,
            cachedWeather.daily,
            cachedWeather.pastPrecipitation,
        );
    }, [clientId, sessions]);
}
