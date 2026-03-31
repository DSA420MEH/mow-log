/**
 * Lawn Intelligence Module
 *
 * Smart mowing advisories derived from Open-Meteo weather data.
 * All calculations are pure functions — no side effects, no API calls.
 *
 * Features:
 *  1. "Is It Safe to Mow Today?" — YES / CAUTION / NO
 *  2. Growth Rate Estimator — mm/day based on temp + moisture
 *  3. "Best Day to Mow This Week" — scored 0-100 per day
 */

import type { HourlyForecast, DailyForecast, WeatherData } from './weather-api';
import * as turf from '@turf/turf';
import type { Feature, LineString, Polygon, MultiPolygon, FeatureCollection } from 'geojson';

// ── 0. Mower Profile & Operational Stats ─────────────────────────────────────

export interface MowerProfile {
    /** Fuel consumption when actively mowing at normal load (L/h) */
    fuelConsumptionRateLh: number;
    /** Fuel consumption when in transit / light load between properties (L/h) */
    transitFuelConsumptionRateLh: number;
    /** Ground speed when transiting between properties under own power (mph) */
    transitSpeedMph: number;
    /** Blade sharpening interval in engine hours */
    bladeSharpenIntervalHours: number;
}

/** Grass/load condition that affects fuel consumption */
export type GrassLoadCondition = 'light' | 'normal' | 'heavy';

/** Fuel multipliers relative to the profile's normal-load rate */
const LOAD_FUEL_MULTIPLIER: Record<GrassLoadCondition, number> = {
    light: 0.70,  // Short/thin grass, minimal resistance
    normal: 1.00, // Standard mowing conditions
    heavy: 1.35,  // Tall, thick, or wet grass — engine works harder
};

export interface MowingStats {
    distanceFeet: number;
    durationMinutes: number;
    passCount: number;
    /** Estimated fuel consumed (liters) — only set when mowerProfile is supplied */
    fuelLiters?: number;
    /** Estimated fuel consumed (US gallons) — only set when mowerProfile is supplied */
    fuelGallons?: number;
}

// ── Transit Cost Calculator ───────────────────────────────────────────────────

export interface TransitStats {
    distanceMiles: number;
    /** Estimated drive time at transit speed (minutes) */
    durationMinutes: number;
    /** Estimated fuel used driving house-to-house (liters) */
    fuelLiters: number;
    /** Estimated fuel used driving house-to-house (US gallons) */
    fuelGallons: number;
}

/**
 * Estimates fuel cost for driving a mower between properties.
 * Uses the mower's light-load transit fuel rate and transit speed.
 *
 * @param distanceMiles - Road distance between two stops (miles)
 * @param mowerProfile  - Active mower's operational profile
 */
export function calculateTransitStats(
    distanceMiles: number,
    mowerProfile: MowerProfile,
): TransitStats {
    const durationHours = distanceMiles / (mowerProfile.transitSpeedMph || 1);
    const fuelLiters = durationHours * mowerProfile.transitFuelConsumptionRateLh;
    return {
        distanceMiles,
        durationMinutes: Math.round(durationHours * 60),
        fuelLiters: Math.round(fuelLiters * 100) / 100,
        fuelGallons: Math.round((fuelLiters / 3.785) * 1000) / 1000,
    };
}

// ── Blade Wear Tracker ────────────────────────────────────────────────────────

export interface BladeWearStatus {
    /** Engine hours elapsed since last sharpening */
    hoursSinceSharpening: number;
    /** Engine hours remaining before next sharpening is due (0 if overdue) */
    hoursUntilDue: number;
    /** True when interval has been reached */
    isDue: boolean;
    /** True when interval has been exceeded */
    isOverdue: boolean;
    /** Wear percentage 0-120+ (>100 = overdue) */
    percentWorn: number;
    /** Human-readable status message */
    message: string;
}

/**
 * Determines blade sharpening status for a mower.
 *
 * @param currentHours       - Total engine hours on the mower
 * @param lastSharpenHours   - Engine hours at the last sharpening
 * @param sharpenIntervalHours - Sharpening interval (typically 25h)
 */
export function getBladeWearStatus(
    currentHours: number,
    lastSharpenHours: number,
    sharpenIntervalHours: number,
): BladeWearStatus {
    const hoursSinceSharpening = currentHours - lastSharpenHours;
    const hoursUntilDue = Math.max(0, sharpenIntervalHours - hoursSinceSharpening);
    const isDue = hoursSinceSharpening >= sharpenIntervalHours;
    const isOverdue = hoursSinceSharpening > sharpenIntervalHours;
    const percentWorn = Math.min(120, (hoursSinceSharpening / (sharpenIntervalHours || 1)) * 100);

    let message: string;
    if (isOverdue) {
        const overdueBy = (hoursSinceSharpening - sharpenIntervalHours).toFixed(1);
        message = `Blades overdue — sharpen now (${overdueBy}h past interval)`;
    } else if (isDue) {
        message = `Blades due for sharpening`;
    } else if (hoursUntilDue <= 5) {
        message = `Sharpen soon — ${hoursUntilDue.toFixed(1)}h remaining`;
    } else {
        message = `Blades OK — ${hoursUntilDue.toFixed(1)}h until next sharpening`;
    }

    return { hoursSinceSharpening, hoursUntilDue, isDue, isOverdue, percentWorn, message };
}

/**
 * Calculates the area of a lawn polygon in square feet.
 * @param polygon - GeoJSON Polygon or Feature<Polygon>
 * @returns Area in square feet
 */
export function calculateLawnArea(polygon: any): number {
    if (!polygon) return 0;
    
    try {
        // turf.area returns area in square meters
        const areaSqMeters = turf.area(polygon);
        // 1 sq meter = 10.7639 sq feet
        return Math.round(areaSqMeters * 10.7639);
    } catch (error) {
        console.error('Error calculating lawn area:', error);
        return 0;
    }
}


// ── 1. Mow Safety Assessment ──────────────────────────────────────────────────

export type MowSafetyLevel = 'yes' | 'caution' | 'no';

export interface MowSafetyResult {
    level: MowSafetyLevel;
    headline: string;
    reasons: string[];
    /** Recommended action if caution/no */
    advice?: string;
}

/**
 * Determines if it's safe to mow today based on:
 * - Rain in last 12 hours (past precip)
 * - Rain forecast in next 4 hours
 * - Current temperature (heat stress > 30°C)
 * - Current wind speed (safety > 30 km/h)
 */
export function computeMowSafety(
    current: WeatherData,
    hourly: HourlyForecast | undefined,
    pastPrecipitation: number[],
): MowSafetyResult {
    const reasons: string[] = [];
    let level: MowSafetyLevel = 'yes';

    // Helper: only escalate level severity, never downgrade
    const escalate = (to: MowSafetyLevel) => {
        const severity: Record<MowSafetyLevel, number> = { yes: 0, caution: 1, no: 2 };
        if (severity[to] > severity[level]) level = to;
    };

    // Check rain in past 12-24 hours (last 1-2 entries in past precip = yesterday + day before)
    const recentRain = pastPrecipitation.length > 0
        ? pastPrecipitation[pastPrecipitation.length - 1]
        : 0;

    if (recentRain > 5) {
        escalate('no');
        reasons.push(`${recentRain.toFixed(1)}mm rain yesterday — grass is wet, risk of ruts and clumping`);
    } else if (recentRain > 2) {
        escalate('caution');
        reasons.push(`${recentRain.toFixed(1)}mm rain yesterday — ground may still be soft`);
    }

    // Check rain forecast in next 4 hours
    if (hourly && hourly.precipitationProbability.length >= 4) {
        const next4h = hourly.precipitationProbability.slice(0, 4);
        const maxPrecipProb = Math.max(...next4h);
        if (maxPrecipProb > 60) {
            escalate('no');
            reasons.push(`${maxPrecipProb}% chance of rain in the next 4 hours`);
        } else if (maxPrecipProb > 40) {
            escalate('caution');
            reasons.push(`${maxPrecipProb}% chance of rain in the next 4 hours`);
        }
    }

    // Temperature check
    const temp = current.temperature;
    if (temp > 32) {
        escalate('caution');
        reasons.push(`${temp}°C — extreme heat stress on grass, mow before 9am or after 5pm`);
    } else if (temp > 30) {
        escalate('caution');
        reasons.push(`${temp}°C — hot, consider raising cut height +0.25"`);
    } else if (temp < 5) {
        escalate('caution');
        reasons.push(`${temp}°C — too cold, grass is dormant`);
    }

    // Wind check
    const wind = current.windspeed;
    if (wind > 40) {
        escalate('no');
        reasons.push(`${wind} km/h wind — unsafe conditions, debris risk`);
    } else if (wind > 30) {
        escalate('caution');
        reasons.push(`${wind} km/h wind — be cautious of debris`);
    }

    // Active rain check via weather code
    const rainingCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
    if (rainingCodes.includes(current.weathercode)) {
        escalate('no');
        reasons.push('Currently raining — wait for it to stop');
    }

    // Generate headline and advice
    let headline: string;
    let advice: string | undefined;

    if (level === 'yes') {
        headline = 'Great day to mow!';
        if (reasons.length === 0) {
            reasons.push(`${temp}°C, ${wind} km/h wind, dry conditions — perfect mowing weather`);
        }
    } else if (level === 'caution') {
        headline = 'Mowing possible, use caution';
        advice = 'Check conditions before heading out. Consider adjusting timing or cut height.';
    } else {
        headline = 'Skip mowing today';
        advice = 'Conditions are not suitable. Wait for better weather to protect the turf.';
    }

    return { level, headline, reasons, advice };
}

// ── 2. Growth Rate Estimator ──────────────────────────────────────────────────

export interface GrowthEstimate {
    /** Estimated total growth in inches since last cut */
    estimatedGrowthInches: number;
    /** Average daily growth rate in mm/day */
    avgGrowthMmPerDay: number;
    /** Number of days since last cut */
    daysSinceLastCut: number;
    /** Human-readable summary */
    summary: string;
    /** Whether the grass urgently needs cutting (> 2 inches of growth) */
    urgent: boolean;
}

/**
 * Estimates how much grass has grown since the last cut date.
 *
 * Uses a simplified cool-season grass model:
 *   growthMmPerDay = baseRate × tempFactor × moistureFactor
 *   baseRate = 3 mm/day (typical cool-season, Eastern Canada)
 *   tempFactor = clamp((temp - 5) / 20, 0, 1.5)   peaks at ~25°C+
 *   moistureFactor = 0.2 (drought) | 0.5 (dry) | 1.0 (normal) | 1.5 (wet)
 */
export function estimateGrowthSinceLastCut(
    daysSinceLastCut: number,
    daily: DailyForecast | undefined,
    pastPrecipitation: number[],
): GrowthEstimate | null {
    if (daysSinceLastCut <= 0 || !daily) return null;

    const BASE_RATE_MM = 3; // mm/day for cool-season grass

    // Get the most recent N days of mean temperature (up to daysSinceLastCut)
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayIdx = daily.dates.indexOf(todayStr);
    if (todayIdx < 0) return null;

    // Calculate total past rain for moisture factor
    const totalPastRain = pastPrecipitation.reduce((s, v) => s + v, 0);
    let moistureFactor: number;
    if (totalPastRain < 3) moistureFactor = 0.3;      // Drought
    else if (totalPastRain < 8) moistureFactor = 0.7;  // Dry
    else if (totalPastRain < 20) moistureFactor = 1.0;  // Normal
    else moistureFactor = 1.4;                          // Wet

    // Estimate daily growth for each day since last cut
    let totalGrowthMm = 0;
    const actualDaysAvailable = Math.min(daysSinceLastCut, todayIdx);

    for (let i = 0; i < actualDaysAvailable; i++) {
        const dayIdx = todayIdx - actualDaysAvailable + i;
        const temp = daily.temperatureMean[dayIdx] ?? 15;

        // Temperature factor: grass grows optimally at 15-25°C
        const tempFactor = Math.max(0, Math.min(1.5, (temp - 5) / 20));

        totalGrowthMm += BASE_RATE_MM * tempFactor * moistureFactor;
    }

    // If we don't have enough daily data, extrapolate
    if (daysSinceLastCut > actualDaysAvailable && actualDaysAvailable > 0) {
        const avgDailyGrowth = totalGrowthMm / actualDaysAvailable;
        totalGrowthMm += avgDailyGrowth * (daysSinceLastCut - actualDaysAvailable);
    }

    const avgGrowthMmPerDay = daysSinceLastCut > 0 ? totalGrowthMm / daysSinceLastCut : 0;
    const estimatedGrowthInches = totalGrowthMm / 25.4; // mm to inches
    const urgent = estimatedGrowthInches > 2;

    let summary: string;
    if (estimatedGrowthInches < 0.5) {
        summary = 'Minimal growth — can wait';
    } else if (estimatedGrowthInches < 1.0) {
        summary = 'Light growth — schedule soon';
    } else if (estimatedGrowthInches < 2.0) {
        summary = 'Ready to mow';
    } else {
        summary = 'Overdue — cut higher first!';
    }

    return {
        estimatedGrowthInches,
        avgGrowthMmPerDay,
        daysSinceLastCut,
        summary,
        urgent,
    };
}

// ── 3. Best Day to Mow This Week ─────────────────────────────────────────────

export interface DayScore {
    date: string;
    dayLabel: string;
    score: number; // 0-100
    isToday: boolean;
}

export interface BestDayResult {
    /** All scored days */
    scores: DayScore[];
    /** The top 1-2 recommended days */
    bestDays: string[];
    /** Human-readable recommendation */
    recommendation: string;
}

/**
 * Scores each day of the upcoming week 0-100 for mowing suitability.
 *
 * Scoring:
 * - No rain forecast = +30 pts
 * - Temp 15-25°C = +25 pts (partial for outside range)
 * - No rain previous day = +15 pts
 * - Low wind < 20 km/h = +10 pts (partial)
 * - Clear skies (low precip prob) = +20 pts (partial)
 */
export function computeBestMowDays(daily: DailyForecast | undefined): BestDayResult | null {
    if (!daily || daily.dates.length < 3) return null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayIdx = daily.dates.indexOf(todayStr);
    if (todayIdx < 0) return null;

    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const scores: DayScore[] = [];

    // Score today + next 6 days (or whatever we have)
    const endIdx = Math.min(todayIdx + 7, daily.dates.length);

    for (let i = todayIdx; i < endIdx; i++) {
        let score = 0;
        const dateStr = daily.dates[i];
        const precipProb = daily.precipitationProbabilityMax[i] ?? 0;
        const precipMm = daily.precipitationSum[i] ?? 0;
        const tempMean = daily.temperatureMean[i] ?? 15;
        const windMax = daily.windSpeedMax[i] ?? 0;
        const prevDayPrecip = i > 0 ? (daily.precipitationSum[i - 1] ?? 0) : 0;

        // Rain forecast score (0-30)
        if (precipMm < 1 && precipProb < 20) {
            score += 30;
        } else if (precipMm < 3 && precipProb < 40) {
            score += 20;
        } else if (precipProb < 60) {
            score += 10;
        }

        // Temperature score (0-25) — peaks at 15-25°C
        if (tempMean >= 15 && tempMean <= 25) {
            score += 25;
        } else if (tempMean >= 10 && tempMean <= 29) {
            score += 15;
        } else if (tempMean >= 5 && tempMean <= 32) {
            score += 5;
        }

        // Previous day rain score (0-15)
        if (prevDayPrecip < 2) {
            score += 15;
        } else if (prevDayPrecip < 5) {
            score += 8;
        }

        // Wind score (0-10)
        if (windMax < 15) {
            score += 10;
        } else if (windMax < 25) {
            score += 5;
        }

        // Clear skies bonus (0-20) — low precipitation probability
        if (precipProb < 10) {
            score += 20;
        } else if (precipProb < 30) {
            score += 12;
        } else if (precipProb < 50) {
            score += 5;
        }

        const dayDate = new Date(dateStr + 'T12:00:00');
        const dayLabel = i === todayIdx ? 'Today' : (i === todayIdx + 1 ? 'Tomorrow' : DAY_NAMES[dayDate.getDay()]);

        scores.push({
            date: dateStr,
            dayLabel,
            score,
            isToday: i === todayIdx,
        });
    }

    // Find best days (top days with score >= 70, or top 2)
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const bestDays = sorted.filter(d => d.score >= 70).slice(0, 2).map(d => d.dayLabel);

    if (bestDays.length === 0 && sorted.length > 0) {
        bestDays.push(sorted[0].dayLabel);
    }

    const recommendation = bestDays.length > 0
        ? `Best window: ${bestDays.join(' & ')}`
        : 'No ideal days this week — check again tomorrow';

    return { scores, bestDays, recommendation };
}

// ── 4. One-Third Rule ────────────────────────────────────────────────────────

export interface OneThirdRuleResult {
    /** Whether the one-third rule is violated */
    violated: boolean;
    /** Current estimated height in inches (target + growth) */
    estimatedCurrentHeight: number;
    /** The target cut height in inches */
    targetHeight: number;
    /** Percentage of blade that would be removed */
    removalPercent: number;
    /** First-pass height suggestion if violated */
    firstPassHeight: number;
    /** Human-readable message */
    message: string;
}

/**
 * Checks if cutting to the target height would violate the one-third rule.
 *
 * Best practice: never remove more than 1/3 of the blade length in a single cut.
 * If violated, suggests a staged cut approach (higher first, then target in 3-4 days).
 *
 * @param growthInches - Estimated grass growth since last cut
 * @param targetHeightIn - Desired cut height (e.g., 2.5")
 * @param lastCutHeightIn - Height of the last cut (defaults to targetHeight)
 */
export function checkOneThirdRule(
    growthInches: number,
    targetHeightIn: number,
    lastCutHeightIn?: number,
): OneThirdRuleResult {
    const lastHeight = lastCutHeightIn ?? targetHeightIn;
    const currentHeight = lastHeight + growthInches;
    const removalInches = currentHeight - targetHeightIn;
    const removalPercent = currentHeight > 0 ? (removalInches / currentHeight) * 100 : 0;

    const violated = removalPercent > 33.3;

    let firstPassHeight = targetHeightIn;
    let message: string;

    if (violated) {
        // Calculate the highest allowed cut that still respects 1/3 rule
        // One-third rule: max removal = currentHeight / 3
        // So minimum remaining = currentHeight × 2/3
        firstPassHeight = Math.round((currentHeight * (2 / 3)) * 4) / 4; // Round to nearest 0.25"

        // Ensure first pass is at least above target
        if (firstPassHeight <= targetHeightIn) {
            firstPassHeight = targetHeightIn + 0.5;
        }

        message = `Grass is ~${currentHeight.toFixed(1)}" — cutting to ${targetHeightIn}" removes ${removalPercent.toFixed(0)}% (>33%). Cut at ${firstPassHeight}" first, then ${targetHeightIn}" in 3-4 days.`;
    } else {
        message = `Safe to cut to ${targetHeightIn}" — only removing ${removalPercent.toFixed(0)}% of blade length.`;
    }

    return {
        violated,
        estimatedCurrentHeight: currentHeight,
        targetHeight: targetHeightIn,
        removalPercent,
        firstPassHeight,
        message,
    };
}

// ── 5. Weighted Soil Wetness Model ───────────────────────────────────────────

export interface SoilWetnessResult {
    /** Weighted wetness score (0 = bone dry, 100+ = saturated) */
    wetnessScore: number;
    /** Human-readable soil condition */
    condition: 'dry' | 'normal' | 'damp' | 'wet' | 'saturated';
    /** Weighted rain total (mm, recent rain weighted 3× more) */
    weightedRainMm: number;
    /** Human-readable summary */
    summary: string;
    /** Whether soil is too wet for safe mowing */
    tooWetToMow: boolean;
}

/**
 * Computes soil wetness using an exponential decay model.
 *
 * Instead of a flat 5-day rain sum, weights recent rain exponentially heavier:
 *   weightedRain = Σ(precip[i] × decay^daysAgo)
 *
 * This better models soil drying:
 * - 20mm over 5 days = soil absorbed it → OK to mow
 * - 20mm today = soil saturated → wait 24h
 *
 * @param pastPrecipitation - Array of daily precip (mm), most recent last
 * @param decay - Decay factor per day (0.6 = recent rain weighs 3× older rain)
 */
export function computeSoilWetness(
    pastPrecipitation: number[],
    decay: number = 0.6,
): SoilWetnessResult {
    if (pastPrecipitation.length === 0) {
        return {
            wetnessScore: 0,
            condition: 'dry',
            weightedRainMm: 0,
            summary: 'No precipitation data available',
            tooWetToMow: false,
        };
    }

    // Calculate weighted rain: most recent day = full weight, older days decay
    let weightedRainMm = 0;
    const len = pastPrecipitation.length;

    for (let i = 0; i < len; i++) {
        const daysAgo = len - 1 - i; // 0 = most recent
        const weight = Math.pow(decay, daysAgo);
        weightedRainMm += pastPrecipitation[i] * weight;
    }

    // Also check the last 2 days for burst detection
    const last2DaysRain =
        (pastPrecipitation[len - 1] ?? 0) + (pastPrecipitation[len - 2] ?? 0);

    // Wetness score: normalize weighted rain to a 0-100+ scale
    // Scale: 0-5mm weighted = dry, 5-12mm = normal, 12-20mm = damp, 20-30mm = wet, 30+ = saturated
    const wetnessScore = Math.min(100, (weightedRainMm / 30) * 100);

    let condition: SoilWetnessResult['condition'];
    let summary: string;
    let tooWetToMow = false;

    if (last2DaysRain > 15) {
        // Burst detection: heavy rain in last 2 days regardless of weighted average
        condition = 'saturated';
        summary = `${last2DaysRain.toFixed(1)}mm rain in last 2 days — soil is saturated`;
        tooWetToMow = true;
    } else if (weightedRainMm > 25) {
        condition = 'saturated';
        summary = `Heavy recent rainfall (${weightedRainMm.toFixed(1)}mm weighted) — wait for soil to dry`;
        tooWetToMow = true;
    } else if (weightedRainMm > 15) {
        condition = 'wet';
        summary = `Ground is still wet from recent rain (${weightedRainMm.toFixed(1)}mm weighted)`;
        tooWetToMow = false; // Can mow with caution
    } else if (weightedRainMm > 8) {
        condition = 'damp';
        summary = `Soil slightly damp — good enough to mow`;
    } else if (weightedRainMm > 3) {
        condition = 'normal';
        summary = `Normal soil moisture — ideal mowing conditions`;
    } else {
        condition = 'dry';
        summary = `Dry conditions — mow at higher cut to protect roots`;
    }

    return {
        wetnessScore,
        condition,
        weightedRainMm,
        summary,
        tooWetToMow,
    };
}
// ── 6. Mowing Pattern Generation ───────────────────────────────────────────

/**
 * Calculates a length-weighted average bearing of all edges in a polygon.
 * This helps determine the "dominant" direction for the mowing pattern.
 */
function getDominantDirection(polygon: any): number {
    const edges: { bearing: number; length: number }[] = [];
    const coords = turf.getCoords(polygon)[0]; // Outer ring

    for (let i = 0; i < coords.length - 1; i++) {
        const p1 = turf.point(coords[i]);
        const p2 = turf.point(coords[i + 1]);
        const bearing = turf.rhumbBearing(p1, p2);
        const length = turf.distance(p1, p2);
        
        // Normalize bearing to [0, 180) since a path and its reverse are same orientation
        let normBearing = bearing % 180;
        if (normBearing < 0) normBearing += 180;
        
        edges.push({ bearing: normBearing, length });
    }

    // Weight bearings by length (using vector averaging to handle circularity)
    let sumX = 0;
    let sumY = 0;
    for (const edge of edges) {
        const rad = (edge.bearing * Math.PI) / 180;
        // Double the angle to handle the 180-degree symmetry
        sumX += Math.cos(2 * rad) * edge.length;
        sumY += Math.sin(2 * rad) * edge.length;
    }

    const avgRad = Math.atan2(sumY, sumX) / 2;
    let avgBearing = (avgRad * 180) / Math.PI;
    if (avgBearing < 0) avgBearing += 180;

    return avgBearing;
}

/**
 * Generates an optimized mowing pattern (LineStrings) for a given lawn and obstacles.
 * Correctly handles orientation, buffering, and obstacle avoidance.
 */
export function generateMowingPath(
    boundary: any,
    obstacles: any[] = [],
    mowerWidthInches: number = 54,
    mowerType: 'standard' | 'zero-turn' = 'standard'
): any {
    if (!boundary) return turf.featureCollection([]);

    try {
        const mowerWidthMeters = mowerWidthInches * 0.0254;
        const deckWidth = mowerWidthMeters;
        const isZeroTurn = mowerType === 'zero-turn';
        const perimeterPasses = isZeroTurn ? 2 : 0;

        const pathSegments: Feature<LineString>[] = [];

        // 1. Generate Perimeter Passes
        // These are concentric insets following the lawn boundary
        let currentBoundary = boundary;
        for (let i = 0; i < perimeterPasses; i++) {
            const insetDistance = -(deckWidth/2 + i * deckWidth);
            const inset = turf.buffer(boundary, insetDistance, { units: 'meters' });
            
            if (inset) {
                // Flatten to handle MultiPolygon and extract rings safely
                const flat = turf.flatten(inset);
                flat.features.forEach(f => {
                    const poly = f.geometry as Polygon;
                    poly.coordinates.forEach(ring => {
                        if (ring.length >= 2) {
                            pathSegments.push(turf.lineString(ring));
                        }
                    });
                });
            }
        }

        // 2. Prepare Work Area for Fill Pattern
        // The fill pattern starts after the perimeter passes
        const fillInsetDistance = -(deckWidth/2 + perimeterPasses * deckWidth);
        let workArea = turf.buffer(boundary, fillInsetDistance, { units: 'meters' });
        
        if (!workArea) return turf.featureCollection(pathSegments);

        // Clip out obstacles (buffered by half a deck width to avoid collisions)
        if (obstacles.length > 0) {
            const obstacleCollection = turf.featureCollection(
                obstacles.map(o => turf.buffer(o, deckWidth/2, { units: 'meters' })).filter(Boolean) as Feature<Polygon | MultiPolygon>[]
            ) as FeatureCollection<Polygon | MultiPolygon>;
            if (obstacleCollection.features.length > 0) {
                const combinedObstacles = turf.union(obstacleCollection);
                if (combinedObstacles) {
                    const diff = turf.difference(turf.featureCollection([workArea, combinedObstacles]));
                    if (diff) workArea = diff;
                }
            }
        }

        // 3. Generate Fill Pattern (Sweep Lines)
        const dominantBearing = getDominantDirection(boundary);
        const pivot = turf.center(boundary);
        const rotatedArea = turf.transformRotate(workArea as Feature<Polygon | MultiPolygon>, -dominantBearing, { pivot });
        const bbox = turf.bbox(rotatedArea);
        const [minX, minY, maxX, maxY] = bbox;

        // Skip if bbox is invalid (e.g. area is too small after insets/clipping)
        if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
            return turf.featureCollection(pathSegments);
        }

        // Space lines by full deck width
        const spacingMeters = deckWidth;
        // Approximation for bbox iteration (Turf bbox is in degrees)
        const latRef = (minY + maxY) / 2;
        const metersPerDegreeLat = 111320;
        const latSpacing = spacingMeters / metersPerDegreeLat;

        let currentY = minY + (latSpacing / 2);
        let passCount = 0;

        while (currentY < maxY) {
            const flatLine = turf.lineString([
                [minX - 0.1, currentY],
                [maxX + 0.1, currentY]
            ]);

            const lineParts = turf.lineSplit(flatLine, rotatedArea);
            if (lineParts.features.length > 0) {
                const segmentsInRow: Feature<LineString>[] = [];
                
                lineParts.features.forEach((segment: any) => {
                    const coords = segment.geometry.coordinates;
                    if (coords && coords.length >= 2) {
                        const mid = turf.midpoint(coords[0], coords[1]);
                        if (turf.booleanPointInPolygon(mid, rotatedArea as any)) {
                            segmentsInRow.push(segment);
                        }
                    }
                });

                // Snake logic: flip direction of every other pass
                const shouldFlip = passCount % 2 === 1;
                
                segmentsInRow.forEach(segment => {
                    let coords = segment.geometry.coordinates;
                    if (shouldFlip) coords = [...coords].reverse();
                    
                    const finalSegment = turf.transformRotate(
                        turf.lineString(coords), 
                        dominantBearing, 
                        { pivot }
                    );
                    pathSegments.push(finalSegment);
                });
                
                if (segmentsInRow.length > 0) passCount++;
            }
            currentY += latSpacing;
        }

        return turf.featureCollection(pathSegments);

    } catch (error) {
        console.error('Error generating mowing path:', error);
        return turf.featureCollection([]);
    }
}

/**
 * Calculates efficiency metrics for a given mowing path.
 *
 * @param path         - FeatureCollection of LineStrings from generateMowingPath
 * @param speedMph     - Mower ground speed while cutting (mph)
 * @param mowerProfile - Optional profile for fuel estimation
 * @param grassLoad    - Grass/load condition affecting fuel burn
 */
export function calculateMowingStats(
    path: FeatureCollection<LineString>,
    speedMph: number = 5,
    mowerProfile?: MowerProfile,
    grassLoad: GrassLoadCondition = 'normal',
): MowingStats {
    let totalMeters = 0;
    const segments = path.features.length;

    path.features.forEach(feature => {
        totalMeters += turf.length(feature, { units: 'meters' });
    });

    const distanceFeet = totalMeters * 3.28084;

    // Time estimation:
    // 1. Driving time (Distance / Speed)
    // 2. Turn penalty (6 seconds per segment connection)
    const metersPerSecond = (speedMph * 1609.34) / 3600;
    const drivingMinutes = (totalMeters / (metersPerSecond || 0.1)) / 60;
    const turnPenaltyMinutes = (segments * 6) / 60;
    const totalMinutes = drivingMinutes + turnPenaltyMinutes;

    let fuelLiters: number | undefined;
    let fuelGallons: number | undefined;
    if (mowerProfile) {
        const durationHours = totalMinutes / 60;
        const loadMultiplier = LOAD_FUEL_MULTIPLIER[grassLoad];
        fuelLiters = Math.round(durationHours * mowerProfile.fuelConsumptionRateLh * loadMultiplier * 100) / 100;
        fuelGallons = Math.round((fuelLiters / 3.785) * 1000) / 1000;
    }

    return {
        distanceFeet: Math.round(distanceFeet),
        durationMinutes: Math.round(totalMinutes),
        passCount: segments,
        ...(fuelLiters !== undefined ? { fuelLiters, fuelGallons } : {}),
    };
}
