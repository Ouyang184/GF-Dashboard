# InTouch via Microsoft Copilot (paste-JSON)

Microsoft 365 Copilot has no public vision API we can call from the app, so the practical "let Copilot do it" flow is:

1. You (or anyone on shift) screenshot the InTouch board.
2. Drop it into Copilot Chat (Edge sidebar or Teams) with a fixed prompt we provide.
3. Copilot returns strict JSON — machine ID → status.
4. Paste that JSON into the AMG dashboard. The floor map updates immediately.

This keeps everything inside your Microsoft Enterprise tenant (no extra API keys, no Azure deployment, no Lovable Cloud), and Copilot's vision is dramatically better than Tesseract on a dense colored board.

You picked "every few minutes (auto)" for cadence, but true auto-refresh needs either a local capture agent or Power Automate + an inbound webhook (which needs Lovable Cloud). So this plan does the manual paste path now and leaves a clean seam for an automated POST endpoint later.

## What changes in the UI

On the Productivity (P) pillar overlay, the floor map gets:

- **"Sync from Copilot" button** → opens a small panel with:
  - The exact prompt to paste into Copilot Chat (copy-to-clipboard button).
  - A textarea to paste the JSON Copilot returns.
  - **Apply** button. Invalid JSON shows an inline error; valid JSON updates tiles instantly.
- **"Re-sync" / "Clear"** actions (already exist from the OCR version, reused).
- **"InTouch · synced N min ago"** badge with the source = "Copilot".
- A subtle **"Refresh due"** pulse on the badge after 5 minutes since last sync, so the operator knows it's stale (since auto-refresh isn't wired yet).

The existing image-upload + Tesseract path is removed — Copilot replaces it.

## The Copilot prompt (shipped in the UI, one-click copy)

```text
You are reading a screenshot of a Wonderware InTouch plant-floor status board.
Each tile shows a machine ID and a colored status background.

Return ONLY valid JSON, no prose, matching this schema:
{
  "sampledAt": "<ISO timestamp you observe in the screenshot, or now>",
  "results": [
    { "id": "<machine id exactly as printed>",
      "status": "ok" | "warn" | "fail" | "qc" | "na",
      "note": "<short reason if not ok, else empty>" }
  ]
}

Color → status mapping:
  green  -> ok
  yellow -> warn
  red    -> fail
  purple -> qc
  blue / gray / dim -> na

Include every tile you can read. Do not invent machines.
```

## Data shape (re-uses existing types)

`IntouchSnapshot` already exists from the OCR work. We keep the same shape so `FloorMap`/`statusFor` don't change:

```ts
type IntouchStatus = "ok" | "warn" | "fail" | "qc" | "na";
type IntouchSnapshot = {
  sampledAt: string;         // ISO
  source: "copilot" | "ocr"; // new field; ocr kept for back-compat reads
  results: Record<string, { status: IntouchStatus; note?: string }>;
};
```

## Files

- **edit** `src/hooks/use-intouch-snapshot.ts`
  - Drop the OCR/image path. Add `ingestJson(text: string)` that Zod-parses the Copilot payload, normalizes `results` array → record keyed by machine ID, stamps `source: "copilot"`, stores in `sessionStorage` under the same key so existing readers keep working.
  - Keep `reset()`, `snapshot`, `busy`, `error`, plus new `minutesSinceSync`.
- **new** `src/components/intouch/CopilotSyncPanel.tsx`
  - Prompt block with copy button, JSON textarea, Apply button, error line, "last synced" + "Refresh due" badge.
- **edit** `src/routes/index.tsx`
  - Replace the file-upload `IntouchFloor` wrapper with one that mounts `CopilotSyncPanel` above `FloorMap`. `FloorMap` keeps consuming the same snapshot via the hook.
- **remove** `src/lib/intouch-ocr.ts` (no longer used). `INTOUCH_TILES` in `src/lib/intouch-layout.ts` becomes optional — keep only the machine ID list, drop the pixel rectangles.
- **remove** `tesseract.js` from `package.json` (bundle savings).

## Trade-offs

- **Not truly auto.** Cadence stays "as often as someone pastes." The UI nudges with a stale badge after 5 min. True auto needs one of:
  - A Power Automate flow that screenshots → calls Copilot/Azure OpenAI → POSTs to `/api/public/intouch-snapshot` (requires Lovable Cloud to store/serve the snapshot across sessions).
  - A small Windows scheduled task next to the InTouch PC doing the same.
  Both are additive; the JSON contract above stays identical.
- **Copilot occasionally hallucinates IDs.** We validate every returned ID against the known `FLOOR_LAYOUT` machine list and silently drop unknowns rather than poisoning the map.
- **Per-browser only.** Snapshot lives in `sessionStorage`, so other users on other devices won't see your paste. Cross-user sync also needs the server endpoint above.

## Open question for later (not blocking this plan)

If you want the automated path next, the cleanest fit on your stack is **Power Automate Premium** (you have Microsoft Enterprise): a 4-step flow runs every 3 minutes, captures the InTouch window, sends to Copilot/Azure OpenAI Vision, POSTs JSON to a Lovable endpoint. That step needs Lovable Cloud enabled — flag when you're ready.
