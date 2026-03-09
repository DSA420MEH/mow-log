"use client";

import { useState, useEffect } from "react";
import { getFullWeatherData } from "@/lib/weather-api";
import { computeCutHeightRecommendation, type CutHeightRecommendation } from "@/lib/cut-height-calc";

// Module-level cache — shared with WeatherWidget's cache via weather-api module
let cachedResult: CutHeightRecommendation | null = null;
let cacheKey = "";

/**
 * Fetches weather data and computes a cut height recommendation.
 * Reuses the same combined Open-Meteo fetch as WeatherWidget — no duplicate requests.
 */
export function useCutHeight(lat: number, lng: number) {
    const [recommendation, setRecommendation] = useState<CutHeightRecommendation | null>(cachedResult);
    const [loading, setLoading] = useState(!cachedResult);

    useEffect(() => {
        if (!lat || !lng) return;
        const key = `${lat},${lng}`;

        if (cachedResult && cacheKey === key) {
            setRecommendation(cachedResult);
            setLoading(false);
            return;
        }

        let cancelled = false;

        async function fetchAndCompute() {
            try {
                setLoading(true);
                const data = await getFullWeatherData(lat, lng);
                if (cancelled) return;

                if (data) {
                    const result = computeCutHeightRecommendation({
                        pastPrecipitation: data.pastPrecipitation,
                        forecastPrecipitation: data.forecastPrecipitation,
                        forecastCloudCover: [], // cloud cover not needed for recommendation accuracy
                        forecastTemperature: data.daily?.temperatureMax?.slice(0, 3) ?? [],
                    });
                    cachedResult = result;
                    cacheKey = key;
                    setRecommendation(result);
                } else {
                    setRecommendation(null);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("Cut height fetch failed:", err);
                    setRecommendation(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchAndCompute();
        return () => { cancelled = true; };
    }, [lat, lng]);

    return { recommendation, loading };
}
