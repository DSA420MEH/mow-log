/**
 * Cut Height Recommendation Calculator
 *
 * Pure function that analyzes historical and forecasted weather data
 * to recommend an optimal grass cutting height.
 */

import type { CutHeightWeatherData } from './weather-api';
import { computeSoilWetness } from './lawn-intelligence';

// ── Tunable Thresholds ─────────────────────────────────────────────────────────
// These are lawn-care heuristics — adjust based on grass type and region.

/** Max total forecast rain (mm) over 3 days to confirm drought outlook */
const DROUGHT_FORECAST_RAIN_THRESHOLD = 3;

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
 * Computes a seasonal offset for grass cutting height.
 * Spring: Fast growth (-0.25")
 * Summer: Heat stress (+0.25")
 * Fall/Winter: Normal/Dormant (0)
 */
function getSeasonalOffset(): number {
    const month = new Date().getMonth(); // 0-indexed (Jan = 0)

    // Spring (Mar:2, Apr:3, May:4)
    if (month >= 2 && month <= 4) return -0.25;

    // Peak Summer (Jul:6, Aug:7)
    if (month >= 6 && month <= 7) return 0.25;

    // Early Summer (Jun) & Fall/Winter (Sep-Feb)
    return 0;
}

/**
 * Computes a cut height recommendation based on recent and forecasted weather.
 *
 * @param data - Historical + forecast weather data from Open-Meteo
 * @returns A recommendation object with level, label, explanation, and icon
 */
export function computeCutHeightRecommendation(data: CutHeightWeatherData): CutHeightRecommendation {
    // 1. Calculate soil wetness using the new exponential decay model
    const soilState = computeSoilWetness(data.pastPrecipitation);

    // 2. Calculate forecast parameters
    const totalForecastRain = data.forecastPrecipitation.reduce((sum, v) => sum + v, 0);
    const avgCloudCover = data.forecastCloudCover.length > 0
        ? data.forecastCloudCover.reduce((sum, v) => sum + v, 0) / data.forecastCloudCover.length
        : 50;

    // 3. Check for extreme heat (e.g., current > 28°C or next 3 days > 32°C)
    // For now, we'll approximate with forecastTemperature (which represents next 3 days)
    const maxForecastTemp = data.forecastTemperature?.length > 0
        ? Math.max(...data.forecastTemperature)
        : 20;

    const isExtremeHeat = maxForecastTemp > 32;

    let baseHeight = 2.5;
    let level: CutHeightLevel = 'standard';
    let explanation = '';
    let icon: CutHeightIcon = 'standard';

    // Drought detection: dry soil + dry forecast
    if (soilState.condition === 'dry' && totalForecastRain < DROUGHT_FORECAST_RAIN_THRESHOLD) {
        level = 'high';
        baseHeight = 3.0;
        explanation = `Dry conditions with minimal rain forecast — keep grass tall to retain moisture`;
        icon = 'drought';
    }
    // Fast growth detection: saturated/wet soil + (more rain OR sunny skies)
    else if (
        (soilState.condition === 'saturated' || soilState.condition === 'wet') &&
        (totalForecastRain > HEAVY_RAIN_FORECAST_THRESHOLD || avgCloudCover < SUNNY_CLOUD_COVER_THRESHOLD)
    ) {
        level = 'low';
        baseHeight = soilState.condition === 'saturated' ? 1.5 : 2.0;
        explanation = `${soilState.summary}${avgCloudCover < SUNNY_CLOUD_COVER_THRESHOLD ? ' + sunny forecast' : ' + more rain coming'} — rapid growth expected, cut shorter`;
        icon = 'growth';
    }
    // Default
    else {
        level = 'standard';
        baseHeight = 2.5;
        explanation = `${soilState.summary} — standard 2.5" is recommended`;
        icon = 'standard';
    }

    // 4. Apply Seasonal & Heat Adjustments
    let finalHeight = baseHeight + getSeasonalOffset();

    // Heat stress overrides Spring offset
    if (isExtremeHeat) {
        finalHeight += 0.25; // Add extra 0.25" to protect roots
        explanation += `. HEAT WARNING (>32°C): Raised cut to ${finalHeight.toFixed(2)}" to prevent scorching.`;
        if (getSeasonalOffset() < 0) {
            explanation += ' (Cancelled Spring drop)';
        }
        level = 'high';
        icon = 'drought';
    } else if (getSeasonalOffset() > 0) {
        explanation += ` (Summer adjustment: +0.25")`;
    } else if (getSeasonalOffset() < 0) {
        explanation += ` (Spring adjustment: -0.25")`;
    }

    // Ensure height doesn't go below absolute minimum bounds (e.g. 1.25) or over max (3.5)
    finalHeight = Math.max(1.25, Math.min(3.5, finalHeight));

    return {
        level,
        label: `Cut at ${finalHeight.toFixed(2)}"`,
        explanation,
        icon,
        recommendedHeightIn: finalHeight,
    };
}
