# Side-by-side animation previews

Build both animation concepts as real, running components and drop them next to each other in the Productivity pillar overlay under a temporary "Pick an animation" panel. Once you choose, I remove the loser and place the winner in its final spot.

## What each looks like

**#2 — Productivity centerpiece strip** (wide, ~2:1)
- Stylized side-profile injection-molding press in flat SVG.
- Loop (~4s): clamp closes → mold glows/fills → clamp opens → finished part slides right along a conveyor → drops off-screen.
- A small counter to the right ticks up on each ejected part (decorative, resets on view).
- Calm, rhythmic, reads as a "heartbeat."

**#4 — Isometric part drop** (compact, ~1:1)
- Small isometric scene: hopper on top, mold in middle, bin below, all SVG.
- Loop (~3s): pellets drop into hopper → mold pulses → molded part falls with a spring bounce into the bin.
- Bin fill level rises across the loops and resets.
- More cinematic, more "toy-like" charm.

## Where they go

- New file: `src/components/productivity/MoldingPressAnim.tsx` (concept #2).
- New file: `src/components/productivity/IsoPartDrop.tsx` (concept #4).
- In `src/routes/index.tsx`, inside the Productivity `PillarDetailOverlay`, add a temporary two-column preview block at the top titled "Pick an animation" with both components and a caption under each.

## Tech

- Pure SVG + Framer Motion (already fine with the stack). No WebGL, no new deps.
- Purely decorative — not wired to live data in this pass. If you like #2, we can later tie the counter to today's MC count; if you like #4, we can tie bin fill to `machinesRunning`.
- Respects `prefers-reduced-motion` (pauses loops).

## After you pick

- Delete the losing component and the "Pick an animation" wrapper.
- Place the winner: #2 spans the top of the Productivity overlay above the KPI bento; #4 sits as a square card inside the bento next to "New Buy Off."

## Out of scope

- No backend changes.
- No changes to other pillars, floor map, or KPI logic.
