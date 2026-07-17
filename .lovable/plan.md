## Goal

Add a **3D Floor Layout** view alongside the existing 2D floor map in the Productivity pillar overlay. The 3D scene is modeled from the uploaded GFLR plant layout PDF (rooms + injection-molding cell placement), with orbit controls and machine tiles colored from the same live API + deviation data the 2D map uses.

## Approach

- Use **`@react-three/fiber` + `@react-three/drei`** (Three.js) — the standard React 3D stack. Adds ~150KB gz but gives real WebGL orbit/zoom, lighting, and smooth machine hover.
- Wrap in `<Suspense>` + `<ClientOnly>` pattern (dynamic import) so Three.js never runs in SSR/prerender.

## Files

**New**
- `src/components/productivity/FloorMap3D.tsx` — the R3F Canvas: floor plane, extruded room walls, machine "boxes," orbit controls, hover tooltip, legend. Lazy-loaded.
- `src/data/plant-layout.ts` — hand-modeled coordinates from the PDF:
  - Rooms as rectangles `{ id, label, x, z, w, d, height, category }` — Warehouse, Fabrication, Tool Room, Grinder Room, Die Storage, Extrusion, Packaging & Assembly, Fab Area WIP, Line-2/10/11, Booster Room, Control Room, Pump Room, Silos zones, Inspection, QC Office, etc.
  - Machine positions grouped by the existing cells in `src/lib/intouch-layout.ts` (Fuseal, SD1, SD2, MD, LD, Coil & Collar, Extrusion). Each machine gets `{ id, x, z }` inside its cell room. Machines render as small extruded boxes labeled with the machine ID.
  - Silo clusters as cylinders.

**Modified**
- `src/routes/index.tsx` — inside the Productivity `PillarDetailOverlay`, add a **2D / 3D toggle** above the existing Floor Map. Default = 2D (unchanged). Switching to 3D renders `<FloorMap3D />` lazily. Reuses the same `floorMap`, `machineJobs`, and deviation data already passed to the 2D map so status colors match exactly.
- `package.json` — add `three`, `@react-three/fiber`, `@react-three/drei`.

## 3D scene details

- Camera: perspective, starts at a ~45° angle looking at the plant center. `OrbitControls` with zoom + pan enabled, vertical rotation clamped so users can't flip upside-down.
- Lighting: soft ambient + one directional "sun" with shadows on machines only (rooms don't cast shadows to keep it clean).
- Floor: single large plane with a subtle grid texture; overall plant outline extruded ~0.05 as a base slab.
- Rooms: extruded low walls (~0.6 high) in muted category colors (warehouse = warm tan, molding cells = neutral, utility = cool gray), each with a floating label at wall height.
- Machines: cuboids ~1×1×1.2, colored by status using the same rules as the 2D map (green = running match, yellow = comparable, red = missing / deviation, grey = not running). On hover: lift slightly, highlight, and show an HTML overlay tooltip with machine ID, part, WO, MC status — mirroring the 2D tooltip.
- Legend + "Reset view" button in a corner overlay.
- Respects `prefers-reduced-motion` (disables idle camera drift; orbit still works).

## Out of scope

- No changes to the 2D map, KPIs, backend, or other pillars.
- Not pixel-accurate to the PDF — it's a stylized, readable 3D representation of the same rooms and cells, not a CAD import.
- No click-to-drill navigation this pass (only hover tooltip) — can add later.
