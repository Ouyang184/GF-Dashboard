import { useCallback, useEffect, useState } from "react";
import { KNOWN_MACHINE_IDS, type IntouchStatus } from "@/lib/intouch-layout";

const STORAGE_KEY = "intouch-snapshot-v2";

export type IntouchTileResult = {
  status: IntouchStatus;
  note?: string;
};

export type IntouchSnapshot = {
  sampledAt: number; // ms epoch
  source: "copilot";
  results: Record<string, IntouchTileResult>;
};

const VALID_STATUSES: ReadonlySet<IntouchStatus> = new Set([
  "ok", "warn", "fail", "qc", "na",
]);

function loadStored(): IntouchSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IntouchSnapshot;
  } catch {
    return null;
  }
}

function parseCopilotJson(text: string): IntouchSnapshot {
  // Tolerate wrapping code fences (```json ... ```).
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Not valid JSON — paste the JSON Copilot returned, nothing else.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Expected a JSON object.");
  const obj = parsed as Record<string, unknown>;
  const rawResults = obj.results;
  if (!Array.isArray(rawResults)) throw new Error("Missing `results` array.");

  const results: Record<string, IntouchTileResult> = {};
  let dropped = 0;
  for (const row of rawResults) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const status = typeof r.status === "string" ? r.status.toLowerCase().trim() : "";
    if (!id || !VALID_STATUSES.has(status as IntouchStatus)) continue;
    if (!KNOWN_MACHINE_IDS.has(id)) { dropped++; continue; }
    results[id] = {
      status: status as IntouchStatus,
      note: typeof r.note === "string" && r.note.trim() ? r.note.trim() : undefined,
    };
  }
  if (Object.keys(results).length === 0) {
    throw new Error(
      dropped > 0
        ? `No matching machine IDs (${dropped} unknown). Check the prompt and re-run Copilot.`
        : "No tiles parsed from the JSON.",
    );
  }

  let sampledAt = Date.now();
  if (typeof obj.sampledAt === "string") {
    const t = Date.parse(obj.sampledAt);
    if (!Number.isNaN(t)) sampledAt = t;
  } else if (typeof obj.sampledAt === "number" && Number.isFinite(obj.sampledAt)) {
    sampledAt = obj.sampledAt;
  }

  return { sampledAt, source: "copilot", results };
}

export function useIntouchSnapshot() {
  const [snapshot, setSnapshot] = useState<IntouchSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const s = loadStored();
    if (s) setSnapshot(s);
  }, []);

  // Re-render every 30s so the "synced N min ago" badge stays current.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const ingestJson = useCallback((text: string) => {
    setBusy(true);
    setError(null);
    try {
      const snap = parseCopilotJson(text);
      setSnapshot(snap);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
      } catch {
        /* quota — fine */
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse JSON");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSnapshot(null);
    setError(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  const minutesSinceSync =
    snapshot ? Math.max(0, Math.floor((Date.now() - snapshot.sampledAt) / 60_000)) : null;

  // Reference `tick` so the lint pass keeps the interval-driven re-render meaningful.
  void tick;

  return { snapshot, busy, error, ingestJson, reset, minutesSinceSync };
}