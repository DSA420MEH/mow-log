# Lawn Care Logic Improvements — Next Agent To-Do

## Context
This is a mowing business management PWA (Next.js 16, React 19, Zustand, Tailwind).
All APIs must be FREE and open source — no paid keys.
Currently uses:
- Open-Meteo (free) for weather + precipitation
- Nominatim/OSM (free) for geocoding
- Esri World Imagery tiles (free) for satellite map
- Turf.js for geospatial math

Cut height logic lives in:
- `src/lib/cut-height-calc.ts` — pure function, returns recommendedHeightIn (1.5 / 2.0 / 2.5 / 3.0 inches)
- `src/lib/weather-api.ts` — Open-Meteo fetches, `getFullWeatherData()` is the combined call
- `src/hooks/use-cut-height.ts` — React hook
- `src/components/WeatherWidget.tsx` — displays current weather + 4-day rain bars

The owner's baseline: 2.5" standard, 3.0" drought, 2.0" wet, 1.5" very wet.

---

## TODO: Better Lawn Care Intelligence

### 1. "Is It Safe to Mow Today?" Card
**Priority: HIGH**
A clear YES / CAUTION / NO banner on the dashboard telling the user if today is a good day to mow.

Logic to build:
- NO mow: rain in last 12 hours OR rain forecast in next 4 hours (wet grass = torn roots, wheel ruts, clumping)
- CAUTION: temperature > 30°C (heat stress on grass — raise cut height, mow early morning instead)
- CAUTION: wind > 30 km/h (safety + debris)
- YES: dry 12h+, no rain next 4h, temp 10–29°C

Open-Meteo already returns `current_weather.weathercode` and hourly forecasts.
Add `&hourly=precipitation_probability,temperature_2m,windspeed_10m` to the combined fetch.
Check the next 4 hours of `precipitation_probability` — if any hour > 40%, flag it.

---

### 2. Growth Rate Estimator (since last cut)
**Priority: HIGH**
The app already tracks `daysSinceLastCut` per client (from sessions).
Combine that with weather to estimate how much the grass has probably grown.

Formula (simplified, works well for cool-season grass like in Eastern Canada):
```
growthMmPerDay = base_rate × temp_factor × moisture_factor
base_rate       = 3mm/day (typical cool-season grass)
temp_factor     = clamp((temp_C - 5) / 20, 0, 1.5)  // peaks at ~25°C
moisture_factor = 0.5 (dry) | 1.0 (normal) | 1.5 (wet) | 0.2 (drought)
```

Display on client card: "Est. grown ~2.5 inches since last cut" so the user knows
if it's urgent or can wait another day.

Data needed: daily avg temperature for each day since last cut — fetch from Open-Meteo
`past_days` + `daily=temperature_2m_mean`. Already partially fetched, just add temp.

---

### 3. "One-Third Rule" Warning
**Priority: MEDIUM**
Lawn best practice: never cut more than 1/3 of the blade length at once.
If current height is 2.5" and the grass has grown to 4"+, cutting to 2.5" in one pass
removes more than 1/3 — that shocks the grass.

Warning logic:
- If estimated growth > recommendedHeightIn × 0.5 (i.e., blade is 50% longer than target)
  → show "Consider cutting at [higher height] first, then come back in 3–4 days"
- Example: target 2.5", but grass is ~4" tall → cut at 3.5" today, 2.5" next visit

---

### 4. Soil Wetness / Drainage Model
**Priority: MEDIUM**
Total mm of rain is not the full picture — timing and intensity matter:
- 20mm over 5 days = soil absorbed it, fine to mow
- 20mm in 2 hours this morning = soil is saturated, wait 24h

Improvements to `cut-height-calc.ts`:
- Add a "recency weight" to past precipitation: rain from yesterday counts 3× more than rain from 4 days ago
- Formula: `weightedRain = sum(precip[i] × decay^(daysAgo))`  where decay = 0.6
- If `weightedRain` (last 2 days) > 15mm → flag wet soil regardless of 5-day total

Open-Meteo `daily=precipitation_sum` already provides this — just need to change
how the array is weighted in `cut-height-calc.ts`.

---

### 5. "Best Day to Mow This Week" Recommendation
**Priority: MEDIUM**
Looking at the 7-day forecast, highlight which days are ideal for mowing.

Score each day 0–100:
- Rain forecast = 0 → +30 pts
- Temp 15–25°C → +25 pts
- Low humidity (<70%) → +20 pts
- No rain previous day → +15 pts
- Low wind (<20 km/h) → +10 pts

Display: "Best window this week: Wednesday & Thursday" on the dashboard.

Open-Meteo data needed: `daily=precipitation_probability_max,temperature_2m_mean,
windspeed_10m_max,relative_humidity_2m_mean` — all free.

---

### 6. Seasonal Adjustment
**Priority: LOW**
The current logic has no concept of season. Improvements:

| Season | Adjustment |
|--------|-----------|
| Spring (Mar–May) | Drop cut height 0.25" — grass growing fast, can handle it |
| Early Summer (Jun) | Standard height |
| Peak Summer (Jul–Aug) | Raise 0.25" — heat stress, shade roots |
| Fall (Sep–Oct) | Gradually lower back, last cut of year slightly lower to reduce snow mold |
| Winter | No mowing |

Simple approach: derive season from `new Date().getMonth()` and apply a `±0.25"` offset
to whatever `computeCutHeightRecommendation` returns.

---

### 7. Rainfall Since Last Cut (Per-Client)
**Priority: MEDIUM**
Right now, the weather data is global (home location, same for all clients).
A more accurate signal: how much rain has fallen *since the last mow at that specific client*.

Implementation:
1. `Session` already has `startTime` and `cutHeightIn`
2. Add a helper `getRainfallSinceDate(lat, lng, sinceDate)` using Open-Meteo `past_days`
3. Filter precip array to only days >= sinceDate
4. Use this per-client rainfall as an additional input to the cut height calc

This is the most accurate signal because the growth is driven by time + rain since the LAST cut,
not just the last 5 days globally.

---

### 8. Temperature-Based "Don't Mow in Heat" Warning
**Priority: LOW**
If current temperature > 28°C or forecast high > 32°C:
- Warn: "Mow before 9am or after 5pm — heat stress can brown cut edges"
- Raise recommendedHeightIn by 0.25" automatically during heat events

Already have `current_weather.temperature` from the combined fetch.

---

## Implementation Notes for Next Agent

### Files to modify:
- `src/lib/cut-height-calc.ts` — add weighted rain, seasonal offset, growth estimate
- `src/lib/weather-api.ts` — add hourly precipitation_probability + temperature to combined fetch
- `src/components/WeatherWidget.tsx` — add "Mow Today?" status badge
- `src/app/addresses/page.tsx` — show growth estimate + best-day recommendation
- `src/lib/store.ts` — already has `cutHeightIn` on Session; no changes needed

### Key constraints:
- ZERO paid APIs — everything from Open-Meteo (free, no key)
- No backend — pure client-side logic
- Keep the combined `getFullWeatherData()` as the single fetch point, just add more fields to it

### Open-Meteo fields to add to the combined URL:
```
&hourly=precipitation_probability,temperature_2m,windspeed_10m
&daily=temperature_2m_mean,precipitation_probability_max,windspeed_10m_max
```
This adds minimal payload but unlocks items 1, 2, 5, and 8 above.
