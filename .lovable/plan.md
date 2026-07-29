## Maintenance Dashboard — Command Center

A separate page at `/maintenance` with a bold, dark cockpit aesthetic (deep navy background, neon cyan + amber accents, dense telemetry, live-feel motion). Linked from the main dashboard header. Data is mocked/simulated on the client so the visuals land now; can be wired to a real `/api/maintenance` endpoint later.

## Look & feel

- Palette: near-black `#05070d` base, panel `#0d1526`, neon cyan `#00e5ff` primary, amber `#ffb020` warn, magenta `#ff2d75` critical, mint `#3dffb0` ok. All tokens added to `src/styles.css` (semantic: `--maint-bg`, `--maint-panel`, `--maint-accent`, etc.).
- Type: Space Grotesk display + JetBrains Mono for telemetry readouts (loaded via `<link>` in `__root.tsx`).
- Chrome: thin cyan hairlines, corner brackets on panels, subtle scanline overlay, animated grid backdrop.

## Layout (single scroll page)

```text
┌───────────────────────────────────────────────────────────────┐
│  MAINTENANCE · COMMAND CENTER    [live clock]  [shift badge]  │
├──────────────┬────────────────────────────┬───────────────────┤
│ FLEET HEALTH │  LIVE TELEMETRY WALL       │ CRITICAL ALERTS   │
│ (radial gauge│  (grid of 20 machine cards │ (streaming feed,  │
│  + big #)    │   w/ mini ECG waveforms,   │  color-coded, new │
│              │   status LED, uptime bar)  │  rows slide in)   │
├──────────────┴────────────────────────────┼───────────────────┤
│ MTBF / MTTR / OEE — animated counters     │ WORK ORDER QUEUE  │
├───────────────────────────────────────────┤ (kanban: Open /   │
│ DOWNTIME PARETO (animated bar race)       │  In Progress /    │
├───────────────────────────────────────────┤  Done, drag-free) │
│ PREDICTIVE RISK MATRIX                    │                   │
│ (heatmap: machine × failure mode,         ├───────────────────┤
│  cells pulse when risk > threshold)       │ SPARES INVENTORY  │
│                                           │ (low-stock chips) │
├───────────────────────────────────────────┴───────────────────┤
│ PM SCHEDULE — 14-day timeline with drag-hover tooltips        │
└───────────────────────────────────────────────────────────────┘
```

## Signature animations

1. **Boot sequence** — on mount, panels fade/scale in staggered with a typewriter "SYSTEM ONLINE · <timestamp>" header line.
2. **Telemetry waveforms** — each machine card has an inline SVG ECG-style line driven by `requestAnimationFrame` (deterministic pseudo-random per machine, cheap ~60fps).
3. **Alert stream** — new alerts slide in from the right with a brief cyan flash; auto-cull after N.
4. **Radial fleet-health gauge** — animated arc + ticking counter easing to the target %.
5. **Downtime pareto bar race** — bars re-sort with spring motion every ~5s as mock data drifts.
6. **Predictive heatmap** — cells with high risk have a slow radial pulse glow.
7. **Ambient backdrop** — faint animated grid + drifting scanline over the whole page (respects `prefers-reduced-motion`).

## Files

**New**
- `src/routes/maintenance.tsx` — the page (createFileRoute("/maintenance") with head() metadata: title "Maintenance · Command Center", meta description, og tags).
- `src/components/maintenance/FleetHealthGauge.tsx`
- `src/components/maintenance/TelemetryWall.tsx` (grid + `MachineTile` + `MiniWaveform`)
- `src/components/maintenance/AlertStream.tsx`
- `src/components/maintenance/KpiCounters.tsx` (MTBF, MTTR, OEE, animated numbers)
- `src/components/maintenance/DowntimePareto.tsx`
- `src/components/maintenance/WorkOrderKanban.tsx`
- `src/components/maintenance/RiskHeatmap.tsx`
- `src/components/maintenance/SparesPanel.tsx`
- `src/components/maintenance/PmTimeline.tsx`
- `src/components/maintenance/CommandChrome.tsx` (page frame: corner brackets, scanline, grid backdrop, header clock)
- `src/data/maintenance-mock.ts` — deterministic mock generators for machines, alerts, WOs, spares, PMs, downtime reasons; a `useMaintenanceStream()` hook that mutates state every 2–5s to feel live.

**Modified**
- `src/styles.css` — add maintenance tokens + a `@keyframes` set (scanline, pulse-glow, slide-in-right-fade, bar-race, tick).
- `src/routes/__root.tsx` — add Google Fonts `<link>` for Space Grotesk + JetBrains Mono; add a small nav pill linking `/` ↔ `/maintenance` in the top-right of the page (only rendered on those routes' shared chrome — or added directly in each route header to avoid touching root layout beyond fonts).
- `src/routes/index.tsx` — add a single "Maintenance →" button in the existing header area linking to `/maintenance`.
- (TanStack Router auto-regenerates `routeTree.gen.ts`.)

## Technical notes

- All motion pure CSS + rAF; no new deps.
- Reuse machine list from `src/lib/intouch-layout.ts` so the telemetry wall matches the real floor.
- Mock stream lives in a tiny store (`useSyncExternalStore`) so multiple panels share ticks without re-fetch loops.
- Respects `prefers-reduced-motion` (disable scanline, freeze waveforms to static snapshot, skip bar race).
- Responsive: grid collapses to 1-col on mobile; telemetry wall becomes horizontal scroll.
- SEO: unique `head()` on `/maintenance`; no og:image (no hero asset).

## Out of scope

- Real backend endpoint — mock only for now (easy swap later; hook signature is API-shaped).
- Auth / user-specific views.
- Editing WOs, PMs, or spares (read-only for this pass; can add inline edit like Notes/Top Issues cards next round).
