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
