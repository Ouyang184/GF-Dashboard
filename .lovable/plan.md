Update all five pillar cards so each one surfaces both quick KPIs and open issues on the face of the card, like the Quality pillar already does.

## What will change

1. **Pillar card KPI row**
   - Render the existing `PILLAR_DETAILS[pillar.key].stats` as a compact row of 3 mini stat badges under the KPI line for every pillar.
   - For **Productivity**, also pull live API numbers (`machinesRunning`, `mcAvailablePercent`, `compliancePercent`) so the card reflects the current backend state.
   - Keep the existing monthly dot grid and shift/scrap section unchanged.

2. **Top Issues on every card**
   - Add a small `TopIssuesCard` (the same editable component used inside the Quality overlay) directly on each pillar card, below the shift/scrap section.
   - Use `pillarKey` values `S`, `D`, `I`, `P` for their own localStorage keys so each pillar keeps its own list.
   - Keep Quality's existing Top Issues card as-is.

3. **Overlay consistency**
   - Safety overlay currently only shows a full-width Monthly Status section. Re-layout it to match Quality/D/I/P: full-width main content on top, then a two-column row with Top Issues and Action Items.
   - Leave the special main sections untouched: Productivity keeps Live KPI tree + charts, Quality keeps Molding Scrap + Scrap Rate chart, Delivery/Inventory keep DeviationFloor.

4. **Styling guardrails**
   - Use the existing card tokens (`bg-card`, `border-border`, `text-muted-foreground`, etc.).
   - Keep the compact size so the 5-card grid still fits without excessive vertical growth.

## Files to edit
- `src/routes/index.tsx` — update `PillarCard`, `PillarDetailOverlay`, and the `PILLAR_DETAILS` stats where needed.

## Out of scope
- No backend changes; Productivity live KPIs already come from `useDashboardData()`.
- No new routes or data sources.