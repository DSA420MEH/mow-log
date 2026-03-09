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
