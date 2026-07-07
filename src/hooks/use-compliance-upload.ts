import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";

const STORAGE_KEY = "compliance:latest:v1";
const EVENT = "compliance:updated";
const SHEET_NAME = "SubmittedChecklistLog";

export type ComplianceData = {
  date: string | null; // ISO date of latest entry
  machinesRunning: number;
  mcAvailable: number;
  mcCompliance: number;
  machinesRunningPct: number; // 0..1
  mcAvailablePct: number;
  mcCompliancePct: number;
  uploadedAt: string;
  fileName: string;
};

function read(): ComplianceData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ComplianceData) : null;
  } catch {
    return null;
  }
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return isNaN(n) ? null : n;
}

export function useComplianceData(): ComplianceData | null {
  const [data, setData] = useState<ComplianceData | null>(() => read());
  useEffect(() => {
    const handler = () => setData(read());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return data;
}

export function useComplianceUploader() {
  return useCallback(async (file: File): Promise<ComplianceData> => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[SHEET_NAME];
    if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found`);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: true,
    });

    // Find latest row with Machines Running populated
    const candidates = rows
      .map((r) => ({
        date: parseDate(r["Date2"] ?? r["Date"]),
        mr: toNum(r["Machines Running"]),
        ma: toNum(r["MC Available"]),
        mc: toNum(r["MC Compliance"]),
        mrp: toNum(r["Machines Running %"]),
        map: toNum(r["MC Available %"]),
        mcp: toNum(r["MC Compliance %"]),
      }))
      .filter((r) => r.mr != null && r.date);
    if (candidates.length === 0) throw new Error("No aggregated rows found");
    candidates.sort((a, b) => (b.date!.getTime() - a.date!.getTime()));
    const latest = candidates[0];

    const payload: ComplianceData = {
      date: latest.date!.toISOString(),
      machinesRunning: latest.mr ?? 0,
      mcAvailable: latest.ma ?? 0,
      mcCompliance: latest.mc ?? 0,
      machinesRunningPct: latest.mrp ?? 0,
      mcAvailablePct: latest.map ?? 0,
      mcCompliancePct: latest.mcp ?? 0,
      uploadedAt: new Date().toISOString(),
      fileName: file.name,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event(EVENT));
    return payload;
  }, []);
}
