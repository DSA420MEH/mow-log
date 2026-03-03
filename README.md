# MowLog 🌿

A premium dark-mode lawn care management app for tracking mowing sessions, client addresses, routes, finances, and weather conditions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16** (App Router, Turbopack) |
| Language | **TypeScript** |
| Styling | **Tailwind CSS** + custom dark theme with neon green (`#c3ff00`) accent |
| UI Components | **shadcn/ui** (Card, Button, Dialog, etc.) |
| State | **Zustand** (persisted to `localStorage`) |
| Icons | **Lucide React** |
| Maps | **Leaflet** / **Mapbox GL** |
| Weather | **Open-Meteo API** (free, no key required) |
| Charts | **Recharts** |
| AI | **Genkit** + **Google AI** (receipt scanning) |
| Validation | **Zod** + **React Hook Form** |

## Deployment

| Item | Value |
|------|-------|
| **Live URL** | **https://mow-log.vercel.app** (note the **hyphen**) |
| **GitHub Repo** | `github.com/DSA420MEEH/mow-log` |
| **Branch** | `main` |
| **Auto-deploy** | ✅ Vercel auto-deploys on every push to `main` |
| **Build command** | `next build` |
| **Framework preset** | Next.js (auto-detected by Vercel) |

### Deployment Workflow

```
Code change → git add → git commit → git push origin main → Vercel auto-builds & deploys
```

> **⚠️ IMPORTANT FOR AGENTS:** Do NOT use `npx vercel` CLI to deploy. Just push to `main` and Vercel handles the rest automatically.

## App Pages

| Route | Description |
|-------|-------------|
| `/addresses` | Main dashboard — client cards with swipe panels (Stats/Info/Route), weather widget, tab switcher (Regular/Per Cut) |
| `/logs` | Mowing session logs, gas logs, maintenance logs with event forms |
| `/route-planner` | Leaflet map with client markers and route optimization |
| `/stats` | Financial charts, workday stats, revenue/profit tracking |
| `/calendar` | Calendar view of mowing sessions |

## Key Architecture Notes

### State Management (Zustand)
- **All app data lives in `localStorage`** via Zustand's `persist` middleware
- Store is defined in `src/lib/store.ts`
- Seed data (`src/lib/seed-data.ts`) only loads when `clients.length === 0` (first visit)
- **If you change seed data defaults (like home coordinates), users with existing data must clear localStorage to see the update**

### Home Location & Weather
- Home address coordinates: **Moncton, NB, Canada** (`46.0878, -64.7782`)
- Weather widget uses the **Open-Meteo API** — no API key needed
- Widget only renders when `homeAddress`, `homeLat`, and `homeLng` are set in the store
- Weather data cached for 1 hour via Next.js `revalidate`

### Design System
- **DO NOT change the existing design** unless explicitly asked
- Background: `#0a0f0d` (deep dark green-black)
- Primary accent: `#c3ff00` (neon green) defined as `--primary` in CSS
- Fonts: **Geist** (heading) + **Geist Mono** (mono) loaded via `next/font/google`
- Glass cards: `bg-white/[0.03]` with `backdrop-blur` and neon borders
- All components use the `glass-card` CSS class for the frosted glass effect

### Build Quirks
- `next.config.ts` has `ignoreBuildErrors: true` due to a `@types/mapbox__point-geometry` type conflict
- This does NOT affect runtime — it's purely a build-time TypeScript issue

## Local Development

```bash
cd mow-log
npm install
npm run dev        # → http://localhost:3000
npm run build      # Production build (verify before pushing)
```

### Environment Variables
- `.env.local` — contains any local-only config
- No paid API keys required (Open-Meteo is free, Mapbox uses a public token)

## File Structure (Key Files)

```
src/
├── app/
│   ├── addresses/page.tsx    ← Main dashboard (WeatherWidget lives here)
│   ├── logs/page.tsx         ← Session & gas logs
│   ├── route-planner/page.tsx
│   ├── stats/page.tsx
│   ├── calendar/page.tsx
│   ├── globals.css           ← Design tokens, DO NOT modify casually
│   └── layout.tsx            ← Root layout with fonts, DO NOT modify casually
├── components/
│   ├── WeatherWidget.tsx     ← Open-Meteo weather display
│   ├── SwipeableClientCard.tsx ← Main client card with 3 swipe panels
│   ├── BottomNav.tsx         ← Fixed bottom navigation bar
│   ├── ClientForm.tsx        ← Add/edit client dialog
│   └── ui/                   ← shadcn/ui primitives
├── lib/
│   ├── store.ts              ← Zustand store (ALL app state)
│   ├── seed-data.ts          ← Demo data + default home location
│   ├── weather-api.ts        ← Open-Meteo API client
│   ├── selectors.ts          ← Computed values (profit, alerts)
│   └── utils.ts              ← Tailwind cn() helper
```

## Agent Rules

1. **Don't touch the design** unless the user explicitly asks for design changes
2. **Always `npm run build`** before pushing to catch errors early
3. **Push to `main`** to deploy — Vercel auto-deploys, no CLI needed
4. **The live URL has a hyphen:** `mow-log.vercel.app`, NOT `mowlog.vercel.app`
5. **localStorage persistence** means seed data changes won't affect existing users unless they clear storage
6. **Keep commits focused** — don't stage unrelated modified files alongside feature changes
