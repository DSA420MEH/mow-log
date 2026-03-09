/**
 * Cut Height Recommendation Calculator
 *
 * Pure function that analyzes historical and forecasted weather data
 * to recommend an optimal grass cutting height.
 */

import type { CutHeightWeatherData } from './weather-api';

// ── Tunable Thresholds ─────────────────────────────────────────────────────────
// These are lawn-care heuristics — adjust based on grass type and region.

/** Max total past rain (mm) over 5 days to consider "drought-like" */
const DROUGHT_PAST_RAIN_THRESHOLD = 5;

/** Max total forecast rain (mm) over 3 days to confirm drought outlook */
const DROUGHT_FORECAST_RAIN_THRESHOLD = 3;

/** Min total past rain (mm) over 5 days to consider "heavy rain" */
const HEAVY_RAIN_PAST_THRESHOLD = 25;

/** Min total forecast rain (mm) over 3 days to confirm continued wet conditions */
const HEAVY_RAIN_FORECAST_THRESHOLD = 10;

/** Cloud cover below this (%) means sunny conditions that accelerate growth */
const SUNNY_CLOUD_COVER_THRESHOLD = 50;

// ── Types ──────────────────────────────────────────────────────────────────────

export type CutHeightLevel = 'high' | 'standard' | 'low';
export type CutHeightIcon = 'drought' | 'standard' | 'growth';

export interface CutHeightRecommendation {
    level: CutHeightLevel;
    label: string;
    explanation: string;
    icon: CutHeightIcon;
    /** Recommended cut height in inches (e.g. 2.5, 3.0) */
    recommendedHeightIn: number;
}

// ── Calculator ─────────────────────────────────────────────────────────────────

/**
 * Computes a cut height recommendation based on recent and forecasted weather.
 *
 * @param data - Historical + forecast weather data from Open-Meteo
 * @returns A recommendation object with level, label, explanation, and icon
 */
export function computeCutHeightRecommendation(data: CutHeightWeatherData): CutHeightRecommendation {
    const totalPastRain = data.pastPrecipitation.reduce((sum, v) => sum + v, 0);
    const totalForecastRain = data.forecastPrecipitation.reduce((sum, v) => sum + v, 0);
    const avgCloudCover = data.forecastCloudCover.length > 0
        ? data.forecastCloudCover.reduce((sum, v) => sum + v, 0) / data.forecastCloudCover.length
        : 50;

    // Drought detection: very little past rain + dry forecast
    if (totalPastRain < DROUGHT_PAST_RAIN_THRESHOLD && totalForecastRain < DROUGHT_FORECAST_RAIN_THRESHOLD) {
        return {
            level: 'high',
            label: 'Cut at 3.0"',
            explanation: `Only ${totalPastRain.toFixed(1)}mm rain in 5 days with ${totalForecastRain.toFixed(1)}mm forecast — keep grass tall to retain moisture`,
            icon: 'drought',
            recommendedHeightIn: 3.0,
        };
    }

    // Fast growth detection: heavy past rain + (more rain OR sunny skies)
    if (totalPastRain > HEAVY_RAIN_PAST_THRESHOLD && (totalForecastRain > HEAVY_RAIN_FORECAST_THRESHOLD || avgCloudCover < SUNNY_CLOUD_COVER_THRESHOLD)) {
        // Very wet (>40mm past 5 days) → 1.5", otherwise 2.0"
        const heightIn = totalPastRain > 40 ? 1.5 : 2.0;
        return {
            level: 'low',
            label: `Cut at ${heightIn.toFixed(1)}"`,
            explanation: `${totalPastRain.toFixed(1)}mm rain in 5 days${avgCloudCover < SUNNY_CLOUD_COVER_THRESHOLD ? ' + sunny forecast' : ' + more rain coming'} — rapid growth expected, cut shorter`,
            icon: 'growth',
            recommendedHeightIn: heightIn,
        };
    }

    // Default: standard conditions
    return {
        level: 'standard',
        label: 'Cut at 2.5"',
        explanation: `Normal conditions — ${totalPastRain.toFixed(1)}mm past rain, ${totalForecastRain.toFixed(1)}mm forecast`,
        icon: 'standard',
        recommendedHeightIn: 2.5,
    };
}
