/**
 * Weather API Service integration using Open-Meteo for MowLog.
 * 
 * Provides current weather data and forecasts for lawn care scheduling.
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
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,cloud_cover_mean&past_days=5&forecast_days=3&timezone=auto`;

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

        // Today's date in the API timezone
        const today = new Date().toISOString().slice(0, 10);
        const todayIdx = dates.indexOf(today);

        // If today isn't found, split at the boundary (5 past + 3 forecast)
        const splitIdx = todayIdx >= 0 ? todayIdx : 5;

        const pastPrecipitation = precip.slice(0, splitIdx).map(v => v ?? 0);
        const forecastPrecipitation = precip.slice(splitIdx).map(v => v ?? 0);
        const forecastCloudCover = cloud.slice(splitIdx).map(v => v ?? 0);

        return { pastPrecipitation, forecastPrecipitation, forecastCloudCover };
    } catch (error) {
        console.error("Failed to fetch cut height weather data:", error);
        return null;
    }
}
