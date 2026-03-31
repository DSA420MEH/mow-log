You are working on MowLog — a Next.js 16, TypeScript, React 19 app.

Tech stack: Tailwind CSS 4, shadcn/ui, Zustand (localStorage persist via src/lib/store.ts),
Lucide React, Leaflet + Mapbox GL + turf.js, Recharts.
Design system: dark bg #0a0f0d, neon green accent #c3ff00, glassmorphism via .glass-card.
⚠️ DO NOT change any existing styles, colors, or design tokens under any circumstances.

---

## FILES TO WORK IN:
- src/app/route-planner/page.tsx (main file — planning mode + drive mode HUD)
- src/lib/store.ts (Zustand store — read only, do not restructure)
- src/types/index.ts (TypeScript types — add only if needed, do not remove)

---

## TASK: Improve the Route Planner with 3 upgrades

### UPGRADE 1 — In-App GPS Route Polyline on the Satellite Map
Currently, the NAV SYSTEMS button opens Google Maps externally with pre-loaded addresses.
Keep that button as-is.

ADD a visual route polyline drawn directly on the Leaflet satellite map in Drive Mode.
- When ENGAGE DRIVE MODE is activated, draw a neon green (#c3ff00) dashed polyline
  connecting all selected clients in their optimized TSP order, using their geocoded lat/lng
- The polyline should update (trim the completed leg) when the user taps DONE on each target
- Use Leaflet's L.polyline() — do NOT add any new map library
- The line should sit above the satellite tiles but below the boundary polygon overlay

### UPGRADE 2 — End-of-Day Report Card Modal
When the user taps ✅ DONE on the LAST target in the route (final client), instead of just
logging the session and returning to Planning Mode, show a full-screen modal styled as a
tactical HUD debrief panel.

The Report Card must display:
- "MISSION COMPLETE" header (neon green, monospace, uppercase)
- Total clients mowed today (count)
- Total mowing time today (summed from all session durations, formatted HH:MM)
- Total revenue earned today (sum of session payments, formatted in CAD $)
- Efficiency % today (mowing time ÷ total workday clock-in time, from WorkSession in store)
- A motivational one-liner at the bottom (pick 3 rotating ones, hardcoded is fine)
- A "CLOSE DEBRIEF" button that dismisses and returns to Planning Mode

Use shadcn/ui Dialog component for the modal. Style it with .glass-card, neon borders,
and monospace font. It must look like the rest of the HUD — dark, tactical, premium.

### UPGRADE 3 — Fix Square Footage Auto-Calc in Command Center
In the boundary editor (Command Center), when a user draws a LAWN BOUNDARY polygon using
the draw tool, the Total Lawn Area field currently shows 0 sq ft.

Fix this so that:
- Every time a polygon is completed or edited, turf.area() is called on the drawn GeoJSON
- The result is converted from square meters to square feet (multiply by 10.7639)
- The value is displayed live in the "TOTAL LAWN AREA" field as: "X,XXX sq ft"
- When the boundary is saved via "SAVE ADDRESS & BOUNDARIES", this sqft value is persisted
  to the client record in the Zustand store (store.ts already has a field for lotSize)

---

## CONSTRAINTS:
- Mobile-first — all 3 upgrades must look and work on a phone screen (375px wide)
- Do NOT touch the design system, color tokens, or .glass-card utility
- Do NOT refactor unrelated components — surgical changes only
- The Report Card modal must NOT fire on intermediate DONE taps, only the final target
- After writing the code, remind me to run: npm run build before pushing to main

---

Build all 3 upgrades now.
