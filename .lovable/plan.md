## Make QDIP pillar cards expandable

Add a click-to-expand panel on each pillar card (Safety, Quality, Delivery, Inventory, Productivity) that reveals more detail below the existing summary.

### Interaction
- Each card gets a chevron button in the header; clicking the card header toggles expanded state.
- Independent per-card state (multiple can be open at once).
- Smooth height/opacity transition; keyboard accessible (button + aria-expanded).
- Fix the existing time hydration warning by rendering the clock only after mount (quiet fix).

### Expanded content per pillar
A consistent layout with pillar-specific data:
- **Trend mini-chart** — 14-day status sparkline derived from the same deterministic RNG.
- **Top issues** — 2–3 bulleted items tailored to the pillar (e.g. Safety: "PPE audit overdue – Line 2"; Quality: "Scrap spike on press 4"; Delivery: "PO #4421 late 1 day"; Inventory: "Resin lot variance"; Productivity: "Downtime: changeover 38m").
- **Action items** — owner + due date chips.
- **Shift breakdown detail** — current shift status with a short note per shift (expanding the compact dot list already shown).
- **Quick stats row** — e.g. MTD ok %, current streak, last incident.

### Technical
- Update `PillarCard` in `src/routes/index.tsx` to use local `useState` for `expanded`, wrap the extra section in a conditionally rendered block with `max-h` + `transition-all` for animation.
- Add a `PILLAR_DETAILS` map keyed by pillar key with issues/actions/stats (static mock content, deterministic where seeded).
- Header becomes a `<button>` with `aria-expanded`; chevron rotates on open.
- Hydration fix: gate `timeStr` rendering on a `mounted` flag so SSR and first client render match.

No backend changes; purely presentational.
