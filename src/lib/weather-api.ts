/**
 * Weather API Service integration using Open-Meteo for MowLog.
 *
 * 100% free, no API key required.
 * Docs: https://open-meteo.com/en/docs
 */

export interface WeatherData {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    is_day: number;
    time: string;
    relative_humidity_2m?: number;
}

export interface WeatherResponse {
    latitude: number;
    longitude: number;
    generationtime_ms: number;
    utc_offset_seconds: number;
    timezone: string;
    timezone_abbreviation: string;
    elevation: number;
    current_weather: WeatherData;
}

/**
 * Fetches the current weather for a given latitude and longitude.
 * 
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns A promise that resolves to the current WeatherData or null on error.
 */
export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherData | null> {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m`;

        // We fetch with cache: 'no-store' or revalidate to ensure fresh data for mowing decisions
        const response = await fetch(url, {
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            throw new Error(`Weather API returned status: ${response.status}`);
        }

        const data = await response.json();
        const currentWeather = data.current_weather as WeatherData;
        // Grab the first hourly humidity value as a reasonable current estimate
        if (data.hourly?.relative_humidity_2m?.length > 0) {
            currentWeather.relative_humidity_2m = data.hourly.relative_humidity_2m[0];
        }
        return currentWeather;
    } catch (error) {
        console.error("Failed to fetch weather data:", error);
        return null;
    }
}

// ── Cut Height Weather Data ────────────────────────────────────────────────────

export interface CutHeightWeatherData {
    /** Past 5 days of precipitation totals (mm/day), oldest first */
    pastPrecipitation: number[];
    /** Next 3 days of forecasted precipitation totals (mm/day) */
    forecastPrecipitation: number[];
    /** Next 3 days of forecasted average cloud cover (0-100%) */
    forecastCloudCover: number[];
    /** Next 3 days of forecasted max temperature (°C) */
    forecastTemperature: number[];
}

/**
 * Fetches historical + forecast weather data for cut height recommendations.
 *
 * Uses Open-Meteo's `past_days` and `forecast_days` params to get:
 * - 5 days of historical daily precipitation
 * - 3 days of forecasted daily precipitation + cloud cover
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns CutHeightWeatherData or null on error
 */
export async function getCutHeightWeatherData(lat: number, lon: number): Promise<CutHeightWeatherData | null> {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,cloud_cover_mean,temperature_2m_max&past_days=5&forecast_days=3&timezone=auto`;

        const response = await fetch(url, {
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            throw new Error(`Weather API returned status: ${response.status}`);
        }

        const data = await response.json();
        const dates: string[] = data.daily?.time ?? [];
        const precip: number[] = data.daily?.precipitation_sum ?? [];
        const cloud: number[] = data.daily?.cloud_cover_mean ?? [];
        const temp: number[] = data.daily?.temperature_2m_max ?? [];

        // Today's date in the API timezone
        const today = new Date().toISOString().slice(0, 10);
        const todayIdx = dates.indexOf(today);

        // If today isn't found, split at the boundary (5 past + 3 forecast)
        const splitIdx = todayIdx >= 0 ? todayIdx : 5;

        const pastPrecipitation = precip.slice(0, splitIdx).map(v => v ?? 0);
        const forecastPrecipitation = precip.slice(splitIdx).map(v => v ?? 0);
        const forecastCloudCover = cloud.slice(splitIdx).map(v => v ?? 0);
        const forecastTemperature = temp.slice(splitIdx).map(v => v ?? 20);

        return { pastPrecipitation, forecastPrecipitation, forecastCloudCover, forecastTemperature };
    } catch (error) {
        console.error("Failed to fetch cut height weather data:", error);
        return null;
    }
}

// ── Combined Widget Data ───────────────────────────────────────────────────────

export interface HourlyForecast {
    /** ISO time strings for next hours */
    time: string[];
    /** Precipitation probability (0-100) per hour */
    precipitationProbability: number[];
    /** Temperature °C per hour */
    temperature: number[];
    /** Wind speed km/h per hour */
    windSpeed: number[];
}

export interface DailyForecast {
    /** ISO date strings */
    dates: string[];
    /** Daily precipitation sum (mm) */
    precipitationSum: number[];
    /** Daily max precip probability (0-100) */
    precipitationProbabilityMax: number[];
    /** Daily mean temperature °C */
    temperatureMean: number[];
    /** Daily max wind speed km/h */
    windSpeedMax: number[];
    /** Daily max temp °C */
    temperatureMax: number[];
    /** Daily min temp °C */
    temperatureMin: number[];
}

export interface FullWeatherData {
    current: WeatherData;
    /** Past 5 days of daily precipitation totals (mm), oldest first */
    pastPrecipitation: number[];
    /** Next 3 days of daily precipitation totals (mm) */
    forecastPrecipitation: number[];
    /** Labels for forecast days, e.g. ["Sat", "Sun", "Mon"] */
    forecastDayLabels: string[];
    /** Total rain over the past 5 days */
    totalPastRainMm: number;
    /** Today's High/Low Temp */
    todayHighLow?: { high: number; low: number };
    /** Hourly forecast data for the next ~12 hours */
    hourly?: HourlyForecast;
    /** Extended 7-day daily forecast + past 7 days of daily data */
    daily?: DailyForecast;
}

/**
 * Single combined Open-Meteo fetch: current weather + 5-day past rain + 3-day forecast.
 * One network request instead of two.
 */
export async function getFullWeatherData(lat: number, lon: number): Promise<FullWeatherData | null> {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current_weather=true` +
            `&hourly=relative_humidity_2m,precipitation_probability,temperature_2m,wind_speed_10m` +
            `&daily=precipitation_sum,cloud_cover_mean,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_probability_max,wind_speed_10m_max` +
            `&past_days=7&forecast_days=8&timezone=auto`;

        const response = await fetch(url, { next: { revalidate: 3600 } });
        if (!response.ok) throw new Error(`Open-Meteo status: ${response.status}`);

        const data = await response.json();

        // Current weather
        const current = data.current_weather as WeatherData;
        if (data.hourly?.relative_humidity_2m?.length > 0) {
            current.relative_humidity_2m = data.hourly.relative_humidity_2m[0];
        }

        // Daily rain split: past vs forecast
        const dates: string[] = data.daily?.time ?? [];
        const precip: number[] = (data.daily?.precipitation_sum ?? []).map((v: number | null) => v ?? 0);

        const today = new Date().toISOString().slice(0, 10);
        const todayIdx = dates.indexOf(today);
        const splitIdx = todayIdx >= 0 ? todayIdx : 7;

        const pastPrecipitation = precip.slice(Math.max(0, splitIdx - 5), splitIdx);
        // Include today + next 3 days as forecast (up to 4 days)
        const forecastPrecipitation = precip.slice(splitIdx, splitIdx + 4);

        // Human-readable day labels for forecast
        const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const forecastDayLabels = dates.slice(splitIdx, splitIdx + 4).map((d, i) => {
            if (i === 0) return "Today";
            if (i === 1) return "Tmrw";
            return DAY_NAMES[new Date(d + "T12:00:00").getDay()];
        });

        const totalPastRainMm = pastPrecipitation.reduce((s, v) => s + v, 0);

        const tMax: number[] = data.daily?.temperature_2m_max ?? [];
        const tMin: number[] = data.daily?.temperature_2m_min ?? [];
        const todayHighLow = tMax[todayIdx] !== undefined && tMin[todayIdx] !== undefined
            ? { high: tMax[todayIdx], low: tMin[todayIdx] }
            : undefined;

        // ── Hourly forecast for next ~12 hours (mow safety check) ──
        const hourlyTimes: string[] = data.hourly?.time ?? [];
        const nowIso = new Date().toISOString();
        const currentHourIdx = hourlyTimes.findIndex((t: string) => t >= nowIso.slice(0, 13));
        const hourlySliceStart = currentHourIdx >= 0 ? currentHourIdx : 0;
        const hourlySliceEnd = hourlySliceStart + 12;

        const hourly: HourlyForecast = {
            time: hourlyTimes.slice(hourlySliceStart, hourlySliceEnd),
            precipitationProbability: (data.hourly?.precipitation_probability ?? []).slice(hourlySliceStart, hourlySliceEnd).map((v: number | null) => v ?? 0),
            temperature: (data.hourly?.temperature_2m ?? []).slice(hourlySliceStart, hourlySliceEnd).map((v: number | null) => v ?? 0),
            windSpeed: (data.hourly?.wind_speed_10m ?? []).slice(hourlySliceStart, hourlySliceEnd).map((v: number | null) => v ?? 0),
        };

        // ── Extended daily forecast for "Best Day" + growth rate ──
        const daily: DailyForecast = {
            dates,
            precipitationSum: precip,
            precipitationProbabilityMax: (data.daily?.precipitation_probability_max ?? []).map((v: number | null) => v ?? 0),
            temperatureMean: (data.daily?.temperature_2m_mean ?? []).map((v: number | null) => v ?? 0),
            windSpeedMax: (data.daily?.wind_speed_10m_max ?? []).map((v: number | null) => v ?? 0),
            temperatureMax: tMax.map((v: number | null) => v ?? 0),
            temperatureMin: tMin.map((v: number | null) => v ?? 0),
        };

        return { current, pastPrecipitation, forecastPrecipitation, forecastDayLabels, totalPastRainMm, todayHighLow, hourly, daily };
    } catch (error) {
        console.error("Failed to fetch full weather data:", error);
        return null;
    }
}
