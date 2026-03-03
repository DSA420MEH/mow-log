"use client";

import { useState, useEffect } from "react";
import { getCutHeightWeatherData } from "@/lib/weather-api";
import { computeCutHeightRecommendation, type CutHeightRecommendation } from "@/lib/cut-height-calc";

// Module-level cache so all cards share one fetch per session
let cachedResult: CutHeightRecommendation | null = null;
let cacheKey = "";

/**
 * React hook that fetches weather data and computes a cut height recommendation.
 * Results are cached at the module level — all cards on the page share a single fetch.
 *
 * @param lat - Latitude (typically the home/base location)
 * @param lng - Longitude
 * @returns { recommendation, loading }
 */
export function useCutHeight(lat: number, lng: number) {
    const [recommendation, setRecommendation] = useState<CutHeightRecommendation | null>(cachedResult);
    const [loading, setLoading] = useState(!cachedResult);

    useEffect(() => {
        const key = `${lat},${lng}`;

        // Return cached result if coordinates match
        if (cachedResult && cacheKey === key) {
            setRecommendation(cachedResult);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        async function fetchAndCompute() {
            try {
                setLoading(true);
                const weatherData = await getCutHeightWeatherData(lat, lng);

                if (cancelled) return;

                if (weatherData) {
                    const result = computeCutHeightRecommendation(weatherData);
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

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [lat, lng]);

    return { recommendation, loading };
}
