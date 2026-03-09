# UI Improvement Prompts — Next Agent

## App Context
MowLog — Next.js 16, React 19, Tailwind v4, Zustand, shadcn/ui components.
Dark theme (#0a0f0d background, #aaff00 / lime-green primary).
Mobile-first PWA. Main pages: /addresses (dashboard), /route-planner, /stats, /logs, /calendar.
Key files: src/app/addresses/page.tsx, src/components/SwipeableClientCard.tsx,
src/components/WeatherWidget.tsx, src/components/BottomNav.tsx, src/app/stats/page.tsx

---

## Prompt 1 — Dashboard Header & Morning Summary Card

"Improve the top section of the addresses page (src/app/addresses/page.tsx).
Right now it's just a title, a settings button, and an Add button.

Replace it with a proper morning dashboard header that includes:

1. A greeting at the top: time-based ('Good morning, Fred', 'Good afternoon, Fred') using
   new Date().getHours() to determine the greeting. Hard-code the name 'Fred' for now.

2. Today's date displayed clearly below the greeting (e.g. 'Saturday, March 8').

3. A compact 'Today at a glance' summary row showing 3 stats pulled from existing store data:
   - Total clients (clients.length)
   - Clients mowed this week (sessions from last 7 days with status=completed, unique clientIds)
   - Revenue this week (sum of client.amount for all per-cut sessions this week)

4. Move the Settings and Add New Address buttons into a cleaner top-right action cluster.

Keep the dark theme (#0a0f0d bg, lime primary). No new dependencies — use only what's
already installed (lucide-react for icons, existing Tailwind classes, existing store).
The WeatherWidget already renders below this header, keep it in place."

---

## Prompt 2 — SwipeableClientCard Visual Overhaul

"The client cards in src/components/SwipeableClientCard.tsx work well functionally but
look a bit flat. Improve the visual design without changing any logic or data:

1. Add a subtle colored top border accent per client — derive the color from the same
   hash function already used for avatarStyle. Map to 4-5 Tailwind border colors
   (emerald, purple, orange, blue, pink) matching the avatar colors already in use.

2. Make the avatar initials circle slightly larger (w-12 h-12 instead of w-11 h-11)
   and add a very subtle glow shadow matching the avatar color on hover.

3. The 'Start Mowing' button currently is a flat lime button. Add a subtle pulsing ring
   animation around it using Tailwind's animate-ping on a pseudo-ring element, to draw
   attention to the primary action. Only animate when NOT actively mowing.

4. The 3 panel tabs (Stats / Info / Route) — make the sliding pill indicator slightly
   taller and add a very faint background glow in the primary color when active.

5. In the Stats panel, the metric grid cards (Visits, Lifetime, Total Work, etc.) —
   add a very subtle left border accent (2px) that matches the client's avatar color
   when hovered, giving each card a slight lift effect.

No new npm packages. All changes are pure Tailwind + existing lucide icons."

---

## Prompt 3 — Bottom Navigation Bar Redesign

"Redesign the bottom navigation (src/components/BottomNav.tsx) to feel more like a
native mobile app tab bar:

1. Read the current file first to understand the existing nav items and active state logic.

2. Increase the height slightly (from whatever it is now to ~64px touch target).

3. The active tab should show:
   - The icon filled/highlighted in the primary lime color
   - A small label below the icon (already there or add it)
   - A pill-shaped background highlight behind the active icon (like iOS tab bars)
   - A subtle lime glow under the active icon: box-shadow or drop-shadow

4. Inactive tabs should be more visibly de-emphasized — icon opacity around 35%,
   no label text visible (hide labels on inactive to reduce clutter).

5. Add a very subtle top border on the nav bar with a gradient:
   from transparent → primary/20 → transparent (left to right) to give it a
   glowing separation from the page content.

6. The nav bar background should be slightly more opaque: bg-[#0d1410]/95 backdrop-blur-xl.

No new dependencies. Keep all existing routing logic intact."

---

## Prompt 4 — Stats Page Charts & Visual Improvements

"Read src/app/stats/page.tsx first, then improve its visual design.
The app already has recharts installed (it's in package.json).

Goals:
1. If there are no charts currently, add a weekly revenue bar chart using recharts BarChart.
   X-axis = last 8 weeks (derive from sessions store data grouped by week).
   Y-axis = revenue that week (sum of client.amount for completed sessions).
   Style: dark background, lime (#aaff00) bars, no grid lines, custom tooltip.

2. Add a 'Mow Frequency' donut/pie chart showing the split between Regular vs PerCut clients
   using recharts PieChart. Colors: lime for Regular, blue-400 for PerCut.

3. Each stat card/number on the page — add a subtle count-up animation on mount.
   Use a simple useEffect with setInterval incrementing from 0 to the final value
   over ~800ms. No external animation library needed.

4. Add a top summary banner with 3 big KPI numbers: Total Revenue All Time,
   Total Mows Completed, Average Revenue Per Mow. Style them large and bold
   with a subtle lime glow on the numbers.

5. Keep the dark theme consistent with the rest of the app."

---

## Prompt 5 — Weather Widget & Cut Height Card Enhancement

"Enhance the WeatherWidget (src/components/WeatherWidget.tsx) and how cut height
is displayed on the addresses page (src/app/addresses/page.tsx).

1. In WeatherWidget, add a weather condition description using the Open-Meteo
   WMO weather code already returned in current_weather.weathercode.
   Map the most common codes to plain English labels:
   0='Clear sky', 1='Mainly clear', 2='Partly cloudy', 3='Overcast',
   45='Foggy', 51='Light drizzle', 61='Light rain', 63='Moderate rain',
   65='Heavy rain', 71='Light snow', 80='Rain showers', 95='Thunderstorm'.
   Display this label next to the sun/cloud icon in small text.

2. Add a min/max temperature for today. Open-Meteo already returns daily data
   in the getFullWeatherData() call (src/lib/weather-api.ts) — add
   &daily=temperature_2m_max,temperature_2m_min to the existing URL and
   return them in FullWeatherData. Display as 'H: 12° L: 3°' next to the current temp.

3. Currently the cut height badge (✂ 2.5\") sits inline with the billing badge on
   each client card. Instead, pull it out and place it as a standalone
   'Today's Cut Height' banner between the WeatherWidget and the client tab selector
   on the addresses page. Make it a full-width card with:
   - Big inch number centered (e.g. '2.5\"')
   - Condition label (Drought Risk / Standard / Fast Growth)
   - The explanation text
   - A scissors icon and appropriate color (amber=drought, white=standard, green=growth)
   This way every client on the page inherits the same daily recommendation visually,
   instead of it being repeated on each card.

4. Remove the cut height badge from individual SwipeableClientCard headers
   (src/components/SwipeableClientCard.tsx) since it's now shown globally above.
   Keep the cutHeight prop and the showCutExplanation state but remove the badge rendering.

No new npm packages."
