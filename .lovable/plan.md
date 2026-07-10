# Plan: Declutter Pillar Cards

## Problem
Each pillar card currently packs in: a header, 3 stacked KPI rows, a 31-day calendar, 7 shift dots, a summary, and a Top Issues list. The cards feel crowded and the KPI rows make the front card look like a spreadsheet rather than a status indicator.

## Goal
Make the front of each pillar read as a **daily/monthly status card** at a glance, while moving deeper diagnostics into the expanded overlay.

## What I will change

### Front card (PillarCard)
Keep only:
- Pillar header: icon + label + KPI line
- 31-day calendar dots (month-over-month status)
- Summary badge: `X ok · Y warn · Z miss`
- Compact Top Issues preview: show only the first issue (or a count), clickable to expand
- Chevron / expand affordance

Remove from front card:
- The 3 stacked KPI rows
- The 7 shift-dot grid

### Expanded overlay (PillarDetailOverlay)
Move into the overlay as dedicated sections:
- **KPIs** — the full stacked KPI rows (including live Productivity data from the backend)
- **Shifts** — the 7 shift-dot grid with per-shift notes
- **Top Issues** — the full editable Top Issues list

### Scope
Apply the same layout consistently to all five pillars: Safety, Quality, Delivery, Inventory, Productivity.

### Non-goals
- No new backend routes or data changes.
- No color palette or typography redesign; keep the existing design tokens.
- No new chart types or data visualizations.

## Files to touch
- `src/routes/index.tsx` — refactor `PillarCard`, `PillarDetailOverlay`, `PillarKpiRow`, and `PillarKpiCard` to the new layout; keep `usePillarStats` and live data wiring intact.

## Success criteria
- Front card shows only header, calendar, summary, and a compact Top Issues preview.
- KPI rows and shift dots appear inside the expanded overlay.
- All five pillars share the same visual hierarchy.
- Productivity overlay still uses live API values (`machinesRunning`, `mcAvailablePercent`, `compliancePercent`).
- Build passes and the dashboard renders without layout overlap.