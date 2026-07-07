import { useEffect, useState } from "react";

export type DashboardRow = {
  id: number;
  dateCreated: string;
  workOrder: string;
  machine: string;
  partNumber: string;
  partDescription: string;
  restartMoldChange: string;
  productionTech: string;
  overallAcceptance: string;
  masterCard: string;
};

export type FloorMapJob = {
  machine: string;
  partNumber: string;
  partDescription: string;
  workOrder: string;
  productionTech: string;
  masterCard: string;
  status: "matching" | "comparable" | "missing";
  dateCreated: string;
};

export type FloorMapEntry = {
  machine: string; // normalized (e.g. "301")
  jobCount: number;
  worstStatus: "matching" | "comparable" | "missing";
  jobs: FloorMapJob[];
};

export type DashboardData = {
  updatedAt: string;
  latestDate: string;
  productionDate: string;
  productionWindowStart: string;
  productionWindowEnd: string;
  machinesRunning: number;
  totalRows: number;
  mcAvailableCount: number;
  mcAvailablePercent: number;
  matchingCount: number;
  matchingPercent: number;
  comparableCount: number;
  comparablePercent: number;
  missingCount: number;
  missingPercent: number;
  complianceCount: number;
  compliancePercent: number;
  reproComplete: number | null;
  // Legacy aliases (still returned by backend)
  availabilityCount: number;
  availabilityPercent: number;
  mastercardYes: number;
  mastercardComparable: number;
  mastercardNo: number;
  complianceYes: number;
  complianceNo: number;
  matching?: number;
  comparable?: number;
  missing?: number;
  latestRows: DashboardRow[];
  machineJobs?: DashboardRow[];
  floorMap?: Record<string, FloorMapEntry>;
};

export type DashboardState = {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: Date | null;
};

const REFRESH_MS = 30_000;

function getBaseUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_API_BASE_URL ?? "http://localhost:3001";
}

export function useDashboardData(): DashboardState {
  const [state, setState] = useState<DashboardState>({
    data: null,
    isLoading: true,
    error: null,
    lastFetchedAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load(initial: boolean) {
      if (initial) setState((s) => ({ ...s, isLoading: true }));
      try {
        const res = await fetch(`${getBaseUrl()}/api/dashboard`, {
          signal: controller.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const json = (await res.json()) as DashboardData;
        if (cancelled) return;
        setState({ data: json, isLoading: false, error: null, lastFetchedAt: new Date() });
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        setState((s) => ({
          ...s,
          isLoading: false,
          error: (err as Error).message || "Failed to reach dashboard API",
        }));
      }
    }

    load(true);
    const id = setInterval(() => load(false), REFRESH_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
    };
  }, []);

  return state;
}