## Problem
The KPI mini-cards on each pillar face (and inside the Safety overlay) use `truncate` on the label with a very small font (9–10px), so labels like "Machines Running", "MC Available", "Recordable Incidents", "On-Time Delivery" get cut off with an ellipsis and users can't tell what the number represents.

## Fix (single file: `src/routes/index.tsx`)

1. **`PillarKpiRow` (pillar card face)**
   - Remove `truncate` from the label.
   - Allow labels to wrap onto 2 lines with `leading-tight` and `min-h` so all 3 cards line up.
   - Bump label size from `text-[9px]` to `text-[10px]`, keep tracking-wide but drop uppercase to `normal-case` (uppercase + narrow width is what's causing the cutoff feel).
   - Slightly reduce value size (`text-sm` → `text-[13px]` bold) so label has room; keep the card compact.
   - Increase padding a touch (`px-2 py-2` → `px-2 py-1.5`) and use `gap-1.5` between cards.

2. **`PillarKpiCard` (inside Safety overlay, under Monthly Status)**
   - Same treatment: no `truncate`, wrap to 2 lines, keep label readable (`text-[11px]`, normal case, `leading-tight`, `min-h`).
   - Keep the larger value (`text-lg`) since there's more room in the overlay.

3. **Shorten a couple of stat labels in `PILLAR_DETAILS`** where the full phrase is long and a shorter version reads the same:
   - Safety: "Recordable Incidents" → "Recordables", keep others.
   - Delivery: "On-Time Delivery" → "On-Time %".
   - Inventory: keep as-is if they already fit after wrapping.
   - Only trim where needed to avoid awkward 3-line wraps; keep meaning obvious.

## Out of scope
- No changes to data sources, overlay structure, or Top Issues cards.
- No layout changes to the 5-card grid.