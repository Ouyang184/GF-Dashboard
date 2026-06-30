## Goal
Replace the current zone-card list in the Productivity expanded overlay with a spatial mosaic floor map that mirrors the +GF+ reference board, with a pulsing pin between machines 301IM30 and 109IM00.

## Layout (spatial mosaic)
Use a CSS Grid (`grid-cols-12 grid-rows-6`) inside the `Floor Layout` panel so zones occupy approximate physical positions:

```text
┌───────────────┬───────────────────────┬───────────┐
│ ENG.          │                       │ SD Cell 1 │
│ Extrusion     │                       ├───────────┤
├───────────────┤    Fuseal Cell        │ SD Cell 2 │
│ Coil & Collar │  [301IM30] ● [109IM00]├───────────┤
│               │                       │ MD Cell   │
├───────────────┼───────────────────────┼───────────┤
│ Vinyls Extr.  │       (aisle)         │ LD Cell   │
└───────────────┴───────────────────────┴───────────┘
```

Each zone = bordered tile with a small label header and a flex-wrap row of machine pills (compact, just the ID). Fuseal Cell is the largest tile and the visual anchor.

## Focus marker
Inside Fuseal Cell, render 301IM30 and 109IM00 as accent-bordered pills with a pulsing dot between them:
- pin: `h-3 w-3 rounded-full bg-accent animate-pulse` + soft `shadow-[0_0_16px_var(--accent)]` halo
- small floating label "Current" above the pin

## Styling
- Zone tile: `rounded-lg border border-border/40 bg-card/40 backdrop-blur p-3`
- Machine pill: `text-[10px] px-2 py-1 rounded border border-border/30 bg-background/50`
- Highlighted pills (301IM30, 109IM00): `border-accent bg-accent/15 text-accent`
- Fuseal Cell tile: subtle `ring-1 ring-accent/30` to draw focus

## Scope
- Only `src/routes/index.tsx`, only the `ProductivityFloorLayout` block inside `PillarDetailOverlay`
- No changes to data, other pillars, or animations elsewhere
- Keep the surrounding overlay, header, Month Status grid intact
