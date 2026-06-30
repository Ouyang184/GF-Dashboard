## Goal
Read the live InTouch board into the AMG dashboard without an API, using in-browser OCR on periodic screenshots — refreshed every few minutes.

## Recommended capture path
A tiny "InTouch capture agent" running on (or near) the PC that displays InTouch:
- Every 3 minutes, take a screenshot of the InTouch window.
- Post it to our app at `POST /api/public/intouch-snapshot` with a shared secret header.
- The app stores the latest image, runs OCR in the browser when the dashboard is open, and updates the floor map.

Why this path: InTouch is a Windows HMI with no public API; a screenshot is the only reliable hand-off. A scheduled local capture beats manual uploads (no human in the loop) and is far simpler than HDMI/RTSP capture.

If a local agent isn't possible right now, fall back to **manual upload**: a hidden "Upload InTouch screenshot" button on the dashboard. Same OCR pipeline, just human-triggered.

## OCR pipeline (in-browser)
- Use `tesseract.js` loaded only on the Productivity overlay (lazy import — keeps the main bundle small).
- Pre-process the image on a canvas before OCR:
  - Crop to the machine-grid area (skip the +GF+ logo / key panel using fixed % bounds calibrated once).
  - Per known zone rectangle (ENG Extrusion, Coil & Collar, Fuseal, SD1, SD2, MD, LD), crop each machine tile.
  - Threshold to black-on-white to help Tesseract on colored backgrounds.
- For each tile, OCR the small region that holds the machine ID + the dominant tile color → status:
  - green = running (ok), yellow = warn, red = alarm (fail), blue = not scheduled (na), purple = QC.
- Match OCR'd ID against the known `FLOOR_LAYOUT` machine list; ignore unmatched strings.
- Output: `Record<machineId, { status, sampledAt }>`.

## Wiring into the dashboard
- New module `src/lib/intouch-ocr.ts` exporting `runIntouchOcr(imageUrl)`.
- New hook `useIntouchSnapshot()` that:
  - Fetches the latest snapshot URL + timestamp (or reads the manually uploaded file).
  - Runs OCR once per snapshot, caches result in `sessionStorage` keyed by snapshot hash.
- `FloorMap` consumes the OCR result: tile color comes from OCR status instead of the current deterministic seed; falls back to seed when no snapshot yet.
- Add a small "InTouch · synced 2 min ago" badge above the floor map, with a manual "Re-sync" button.

## Calibration (one-time)
- Ship a hidden `/intouch-calibrate` route that overlays the configured zone/tile rectangles on the latest snapshot so you can fine-tune % bounds by eye and save them to `src/lib/intouch-layout.ts`.

## Scope
- New files: `src/lib/intouch-ocr.ts`, `src/lib/intouch-layout.ts`, `src/hooks/use-intouch-snapshot.ts`, `src/routes/intouch-calibrate.tsx`, `src/routes/api/public/intouch-snapshot.ts` (POST + GET-latest).
- Edits: `FloorMap` in `src/routes/index.tsx` to read OCR statuses; Productivity overlay header to show sync badge.
- New dep: `tesseract.js`.
- Storage: latest snapshot saved in Lovable Cloud Storage (private bucket; signed URLs).

## Trade-offs to know
- Tesseract.js on a dense colored board is imperfect. Color-based status detection is the reliable signal; OCR is only used to bind a tile to a machine ID. If a tile's text is unreadable, we keep the position from `FLOOR_LAYOUT` and trust the color.
- Refresh is "every few minutes" — anything tighter (live) needs the local agent path; manual uploads can't sustain that.
- Lovable Cloud must be enabled for snapshot storage + the upload endpoint. If you'd rather skip Cloud, we can keep the latest snapshot only in the user's browser (manual upload only).

## Open question
Do you have a Windows PC next to the InTouch display where we can run a 30-line PowerShell/Python capture script as a scheduled task? If yes → agent path. If no → manual upload path. Either way, the OCR + floor-map wiring is the same.
