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

// Cache for client-specific weather data
const clientWeatherCache: Record<string, FullWeatherData> = {};
const pendingFetches: Record<string, Promise<FullWeatherData | null>> = {};

/**
 * Per-client growth estimate hook.
 * Uses the client's specific lat/lng if available for accurate local rainfall,
 * otherwise falls back to the globally cached weather.
 */
export function useGrowthEstimate(clientId: string): GrowthEstimate | null {
    const sessions = useStore((s) => s.sessions);
    const client = useStore((s) => s.clients.find((c) => c.id === clientId));

    const [localWeather, setLocalWeather] = useState<FullWeatherData | null>(null);

    // 1. Find the last cut details synchronously
    const cutDetails = useMemo(() => {
        const clientSessions = sessions
            .filter((s) => s.clientId === clientId && s.status === 'completed' && s.endTime)
            .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());

        if (clientSessions.length === 0) return null;

        const lastMowDate = new Date(clientSessions[0].endTime!);
        const daysSinceLastCut = Math.floor(
            (Date.now() - lastMowDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastCut <= 0) return null;

        return {
            daysSinceLastCut,
            lastCutHeightIn: clientSessions[0].cutHeightIn,
        };
    }, [clientId, sessions]);

    // 2. Fetch specific client weather if they have coords
    useEffect(() => {
        if (!client?.lat || !client?.lng || !cutDetails) return;

        const key = `${client.lat},${client.lng}`;

        let cancelled = false;

        async function fetchClientWeather() {
            if (clientWeatherCache[key]) {
                setLocalWeather(clientWeatherCache[key]);
                return;
            }

            // Deduplicate concurrent fetches for the same coords
            if (!pendingFetches[key]) {
                pendingFetches[key] = getFullWeatherData(client!.lat!, client!.lng!);
            }

            try {
                const data = await pendingFetches[key];
                if (cancelled) return;

                if (data) {
                    clientWeatherCache[key] = data;
                    setLocalWeather(data);
                }
            } catch (err) {
                console.error(`Failed to fetch local weather for client ${clientId}`, err);
            }
        }

        fetchClientWeather();
        return () => { cancelled = true; };
    }, [client?.lat, client?.lng, cutDetails]);

    // 3. Compute growth using the most accurate weather available
    return useMemo(() => {
        if (!cutDetails) return null;

        // Priority: local client weather -> global home weather
        const weatherToUse = localWeather || cachedWeather;

        if (!weatherToUse?.daily) return null;

        return estimateGrowthSinceLastCut(
            cutDetails.daysSinceLastCut,
            weatherToUse.daily,
            weatherToUse.pastPrecipitation,
        );
    }, [cutDetails, localWeather]);
}
