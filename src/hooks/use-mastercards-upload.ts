import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";

const STORAGE_KEY = "mastercards:monthly-counts:v1";
const EVENT = "mastercards:updated";

export type MastercardsData = {
  fiscalYearStart: number;
  counts: number[]; // 12 entries, fiscal order (Dec..Nov)
  uploadedAt: string;
  fileName: string;
  totalRows: number;
};

function read(): MastercardsData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MastercardsData) : null;
  } catch {
    return null;
  }
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel serial dates are large (>= ~10000 for year 1927+). Reject small ints
    // like machine IDs that would otherwise parse as epoch-1970 dates.
    if (v < 10000 || v > 100000) return null;
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (typeof v === "string") {
    // Require an ISO-ish date shape to avoid matching random strings.
    if (!/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(v)) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    return y >= 1990 && y <= 2100 ? d : null;
  }
  return null;
}

export function useMastercardsData(): MastercardsData | null {
  const [data, setData] = useState<MastercardsData | null>(() => read());
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

export function useMastercardsUploader() {
  return useCallback(async (file: File): Promise<MastercardsData> => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const rowsAll: Record<string, unknown>[] = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: null,
        raw: true,
      });
      rowsAll.push(...rows);
    }

    if (rowsAll.length === 0) throw new Error("Workbook is empty");

    // Find the column whose values parse as dates most often.
    const columns = Object.keys(rowsAll[0] ?? {});
    // Prefer columns whose name looks date-y; otherwise fall back to best hit rate.
    const preferred = columns.filter((c) => /date|proc|day|time|completed|created/i.test(c));
    const ordered = [...preferred, ...columns.filter((c) => !preferred.includes(c))];
    let bestCol: string | null = null;
    let bestHits = 0;
    for (const col of ordered) {
      let hits = 0;
      for (const r of rowsAll) if (parseDate(r[col])) hits++;
      if (hits > bestHits) {
        bestHits = hits;
        bestCol = col;
      }
    }
    if (!bestCol || bestHits === 0) {
      throw new Error("No date column detected in workbook");
    }
    console.info("[mastercards] using date column:", bestCol, "with", bestHits, "parsed dates");

    // Determine current fiscal year (starts December).
    const now = new Date();
    const fiscalYearStart = now.getMonth() === 11 ? now.getFullYear() : now.getFullYear() - 1;

    // Bucket by fiscal month index: Dec(fiscalYearStart)=0, Jan..Nov(fiscalYearStart+1)=1..11
    const counts = new Array(12).fill(0);
    for (const r of rowsAll) {
      const d = parseDate(r[bestCol]);
      if (!d) continue;
      const y = d.getFullYear();
      const m = d.getMonth();
      let fyIdx = -1;
      if (y === fiscalYearStart && m === 11) fyIdx = 0;
      else if (y === fiscalYearStart + 1 && m <= 10) fyIdx = m + 1;
      if (fyIdx >= 0) counts[fyIdx]++;
    }

    const payload: MastercardsData = {
      fiscalYearStart,
      counts,
      uploadedAt: new Date().toISOString(),
      fileName: file.name,
      totalRows: rowsAll.length,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event(EVENT));
    return payload;
  }, []);
}