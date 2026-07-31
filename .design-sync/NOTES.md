# design-sync notes for amg-dashboard-code-app

- This repo is a Power Apps Code App (a specific business dashboard), not a published component-library package. `src/components/ui/` is the generic shadcn/ui scaffold, not a bespoke branded design system — synced anyway per explicit user request.
- No `dist/` library build, no `main`/`module`/`exports` in `package.json`, no barrel index for `src/components/ui/`. **Synth-entry mode applies.**
- `--entry ./src/index.ts` is passed on every build/resync invocation as a placeholder path (the file does not exist) — its only purpose is to anchor `PKG_DIR` at the repo root via the directory walk-up in `package-build.mjs`'s entry-resolution logic, since `resolveDistEntry` treats a non-existent override as a soft miss and falls through to synth-entry from `src/`. This prints an expected `[NO_DIST] --entry ./src/index.ts doesn't exist` line on every build — not an error to chase.
- `cfg.srcDir = "src/components/ui"` scopes the synth-entry scan to just the shadcn primitives — without it, discovery would scan the entire app's `src/` tree and pick up dozens of app-specific business components (PillarCard, DeviationFloor, KpiTree, etc.) that are not part of any reusable design system.
- `cfg.cssEntry = "src/styles.css"` — the Tailwind v4 stylesheet with the actual token definitions (`:root`/`.dark` CSS custom properties + `@theme inline` mappings).
- Do NOT add `entry` as a top-level `.design-sync/config.json` key — it isn't in the documented config schema and the strict validator may reject it. Always pass `--entry ./src/index.ts` as a CLI flag instead.

## Re-sync risks
- Component count/list depends entirely on synth-entry PascalCase-export scanning of `src/components/ui/*.tsx` — adding/removing/renaming files there changes the synced set with no `.d.ts` contract to catch drift.
- `.d.ts` contracts here are weaker than a real build would produce (per the skill's own caveat for synth-entry mode) — no tsc-verified prop extraction pass, so complex prop types may need `cfg.dtsPropsFor` overrides discovered during the verify loop.
- If this repo ever gains a real component-library build (separate `dist/` + `package.json` exports for just the UI kit), re-point `cfg.srcDir` away and drop the `--entry` placeholder trick — a real dist entry gives materially stronger `.d.ts` contracts.
