## Add a floor-layout panel to the Productivity expanded view

When the Productivity (P) pillar is expanded, show a simplified plant floor schematic that mirrors the reference board's machine grid, with the "current focus" cell highlighted between machines **301IM30** and **109IM00**.

### Scope
- Productivity pillar only. Safety / Quality / Delivery / Inventory keep their current overlay.
- Purely visual — no real data wiring. Just rectangles labeled with machine IDs grouped by cell.

### What renders
Inside `PillarDetailOverlay`, when `pillar.key === "P"`, insert a new section above the existing grid:

**"Floor Layout — Current Position"**
A schematic grid of the Little Rock plant, grouped into the same zones shown on the reference board:
- ENG. Extrusion (11EM00, 2EM20, 10EM00, 4EM20)
- Coil & Collar (419AM0, 417AM0, 415AM0, 413AM0, COIL5, COIL6)
- Fuseal Cell (307IM30, 306IM30, 305IM30, **301IM30**, **109IM00**, 310IM30)
- SD Cell 1 (222IM10, 213IM10, 212IM10, 423IM10, 101IM10)
- SD Cell 2 (113IM00, 210IM00, 209IM00, 114IM00, 433IM10, 104IM10, 115IM00)
- MD Cell (201IM40, 512IM40, 443IM10, 513IM40)
- LD Cell (523IM40, 202IM50, 913IM50, 102IM50)
- Vinyls Extrusion (1EM10)

Each machine is a small tile with the ID. Tiles are dim/neutral by default. **301IM30** and **109IM00** get a soft highlight (border + glow). A pulsing "current position" marker sits between them with a short label like "Current focus: Fuseal Cell · between 301IM30 and 109IM00."

A tiny legend explains the marker. No data, no status colors per machine.

### Technical
- Add a `FLOOR_LAYOUT` constant (array of zones with machine IDs).
- New component `ProductivityFloorLayout` inside `src/routes/index.tsx`, rendered conditionally in `PillarDetailOverlay` when `pillar.key === "P"`.
- Use Tailwind grid: outer 4-column responsive grid of zone cards; inside each card, machines in a small flex-wrap of pill tiles.
- Highlighted tiles use existing tokens (`bg-accent/20`, `border-accent`, `shadow-[0_0_12px_var(--accent)]`); current marker uses `animate-pulse` with `bg-accent`.
- No changes to other pillars, layout files, or data logic.
