## Changes to `src/routes/index.tsx`

**1. Remove from home page**
- Delete the `MasterCard Compliance` `StatCard` in the top stats row (line 318). Replace the 4-col grid with 3 cards: Month, Open Escalations, LotteryCard — grid becomes `md:grid-cols-3`.
- Delete the `Availability vs Compliance` `NotesCard` (lines 351–354). Footer notes grid becomes `lg:grid-cols-2` with just Open Escalations + Long Term Actions.

**2. Add a merged "Availability vs Compliance" tree card into the Productivity pillar overlay**

Only mount it when `pillar.key === "P"`, placed **above** `IntouchFloor` inside the Productivity section (mirrors how D/I get the floor map). Update the conditional at line 778 so:
- `D` / `I` → `<IntouchFloor />` only (unchanged)
- `P` → new `<CompliancePanel />` **then** `<IntouchFloor />`, both full-width
- others → existing Month Status + Shifts

**3. New `CompliancePanel` component (tree/hierarchy visual)**

Root node "Productivity" branching into two children "Availability 55%" and "Compliance 80%", each with leaf metrics. Rendered as a simple SVG-free CSS tree using the existing tokens (`bg-card`, `border-border`, `text-primary`, `text-success`, `text-warning`) — no new deps.

```text
              ┌─────────────────────┐
              │    Productivity     │
              └──────────┬──────────┘
              ┌──────────┴──────────┐
    ┌─────────▼────────┐   ┌────────▼─────────┐
    │ Availability 55% │   │ Compliance 80%   │
    └───┬──────────────┘   └──┬───────────────┘
        ├─ Matching: 7        ├─ 6 of 10 available
        ├─ Comparable: 3      ├─ Repro: 6/18 (33%)
        └─ Downtime alerts    └─ 2 MC in cabinet
```

Structure: nested flex columns with connector lines drawn via `border-l` / `border-t` on child wrappers (same trick already used in `NotesCard`-style tokens). Root and branch nodes are pill-style rounded boxes matching the mastercard aesthetic (`rounded-xl border border-border/60 bg-card px-4 py-3 shadow-[var(--shadow-card)]`). Leaves use small muted list rows.

No new files, no dep changes, no data-model changes — purely presentational reshuffle inside `src/routes/index.tsx`.
