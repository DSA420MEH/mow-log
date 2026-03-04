# MowLog Brand DNA

## Core Identity
MowLog should feel like a premium field-ops cockpit for lawn care pros. The UI tone is sharp, calm, and high-trust. It should look "pro tool," not "startup dashboard."

## Visual Direction
- Keep the dark glass aesthetic as baseline.
- Primary accent is electric green (`#c3ff00`) for key actions and successful outcomes.
- Surfaces should use subtle translucency, thin neon borders, and layered depth.
- Avoid flat white panels or generic SaaS defaults.

## Typography
- Headings: Geist (strong, compact, high contrast).
- Data/time/currency: Geist Mono for operational clarity.
- Keep text dense but readable; avoid oversized copy blocks.

## Component Rules
- Reuse existing `glass-card` treatment for all major containers.
- Action hierarchy:
  - Primary: green filled
  - Secondary: muted surface
  - Destructive: red, explicit, never ambiguous
- Every data card must communicate state at a glance (active, warning, overdue, complete).

## Motion and Interaction
- Prefer purposeful transitions (status flips, modal open/close, loading feedback).
- Keep motion short and functional. No decorative movement loops.
- Scanning and async actions must always show one of: loading, success, error.

## Accessibility Baseline
- Meet WCAG 2.1 AA contrast on all text and controls.
- Every icon-only action must have a clear accessible label or tooltip.
- Keyboard and touch workflows must both be supported.

## Frontend Output Guardrails
- Stay within Next.js App Router + TypeScript + Tailwind + shadcn/ui patterns already used in this codebase.
- Preserve current design tokens and layout rhythm.
- For any new feature, include mobile-first behavior and one desktop validation pass.
