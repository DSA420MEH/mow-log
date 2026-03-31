# MowLog 🌿

A premium dark-mode lawn care management app for tracking mowing sessions, client addresses, routes, finances, and weather conditions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16** (App Router, Turbopack) |
| Language | **TypeScript** |
| Runtime | **React 19** |
| Styling | **Tailwind CSS 4** + custom dark theme with neon green (`#c3ff00`) accent |
| UI Components | **shadcn/ui** or **Stitch** premium components (Card, Button, Dialog, etc.) |
| State | **Zustand** (persisted to `localStorage`) |
| Icons | **Lucide React** |
| Maps | **Leaflet** / **Mapbox GL** + **turf.js** for geometry |
| Weather | **Open-Meteo API** (free, no key required) |
| Charts | **Recharts** |
| AI | **Genkit** + **Google AI** (receipt scanning & smart features) |
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
| `/addresses` | Main dashboard — client cards with swipe panels (Stats/Info/Route), weather widget, tab switcher (Regular/Per Cut). Includes unified filter/search. |
| `/logs` | Mowing session logs, gas logs, maintenance logs with event forms. |
| `/route-planner` | Leaflet map with client markers, boundary drawing/saving, and route optimization. Supports persistence of viewport and zoom. |
| `/stats` | Financial charts, workday stats, revenue/profit tracking. |
| `/calendar` | Weekly/Monthly view of mowing sessions. |

## Key Architecture & Features

### State Management & Persistence (Zustand)
- **All app data lives in `localStorage`** via Zustand's `persist` middleware.
- Store is defined in `src/lib/store.ts`.
- **Map Persistence:** Zoom and center state are persisted via `usePersistentMapState` to ensure a consistent experience across reloads.
- Seed data (`src/lib/seed-data.ts`) only loads when `clients.length === 0`.

### Smart Address Search
- Uses a fallback mechanism: attempts primary geocoding, then falls back to **Nominatim** (OpenStreetMap) if needed to ensure robust address lookup regardless of API availability.

### Home Location & Weather
- Home address coordinates: **Moncton, NB, Canada** (`46.0878, -64.7782`).
- Weather widget uses the **Open-Meteo API** — no API key needed.
- Cache-revalidated every 1 hour.

### Design System
- **Background:** `#0a0f0d` (deep dark green-black).
- **Primary Accent:** `#c3ff00` (neon green) defined as `--primary`.
- **Glassmorphism:** `bg-white/[0.03]` with `backdrop-blur` and neon borders. All glass components use the `.glass-card` utility.
- **Typography:** **Geist** and **Geist Mono**.

### Build Notes
- `next.config.ts` ignores build errors for type conflicts in some map dependencies (`@types/mapbox__point-geometry`).

## Local Development

```bash
cd mow-log
npm install
npm run dev        # → http://localhost:3000
npm run build      # Production build (verify before pushing)
```

## File Structure (Key Files)

```
src/
├── app/
│   ├── addresses/page.tsx    ← Main dashboard
│   ├── route-planner/        ← Map & Route Optimization
│   ├── globals.css           ← Design tokens & Tailwind 4 layers
│   └── layout.tsx            ← Root layout
├── components/
│   ├── WeatherWidget.tsx     ← Open-Meteo integrated display
│   ├── SwipeableClientCard.tsx ← Dashboard cards with 3-way swipe
│   ├── UnifiedGameMap.tsx    ← Shared map component
│   └── ui/                   ← shadcn/ui primitives
├── hooks/
│   ├── usePersistentMapState.ts ← Persists map viewport
├── lib/
│   ├── store.ts              ← Zustand (state & persistence)
│   ├── weather-api.ts        ← API integration
│   └── selectors.ts          ← Business logic & computed stats
```

## Agent Quality Gates

1. **Don't touch the design** unless explicitly asked.
2. **Test across viewports** (Mobile/Desktop) before pushing.
3. **Always run `npm run build`** to catch strict Next.js/React 19 errors.
4. **Push to `main`** to trigger live deployment.
5. **localStorage awareness** — updates to defaults require storage clearing for existing users.

---

## Slash Commands

### `/mowlog`
Loads the MowLog project context including tech stack, architecture, and current roadmap.
