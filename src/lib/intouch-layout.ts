// Known machine IDs that may appear in the InTouch board snapshot.
// Used to validate IDs returned by Microsoft Copilot before applying them.

export type IntouchStatus = "ok" | "warn" | "fail" | "qc" | "na";

export const KNOWN_MACHINE_IDS: ReadonlySet<string> = new Set([
  // ENG. Extrusion
  "11EM00", "2EM20", "10EM00", "4EM20",
  // Vinyls Extrusion
  "1EM10",
  // Coil & Collar
  "419AM0", "417AM0", "415AM0", "413AM0", "COIL5", "COIL6",
  // Fuseal Cell
  "310IM30", "307IM30", "306IM30", "305IM30", "301IM30", "109IM00",
  // SD Cell 1
  "222IM10", "213IM10", "212IM10", "423IM10", "101IM10",
  // SD Cell 2
  "113IM00", "210IM00", "209IM00", "114IM00", "433IM10", "104IM10", "115IM00",
  // MD Cell
  "201IM40", "512IM40", "443IM10", "513IM40",
  // LD Cell
  "523IM40", "202IM50", "913IM50", "102IM50",
]);

export const COPILOT_PROMPT = `You are reading a screenshot of a Wonderware InTouch plant-floor status board.
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

Color -> status mapping:
  green  -> ok
  yellow -> warn
  red    -> fail
  purple -> qc
  blue / gray / dim -> na

Include every tile you can read. Do not invent machines.`;