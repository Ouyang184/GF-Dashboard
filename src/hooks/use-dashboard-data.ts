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

export type DashboardData = {
  updatedAt: string;
  totalRows: number;
  availabilityCount: number;
  availabilityPercent: number;
  mastercardYes: number;
  mastercardComparable: number;
  mastercardNo: number;
  complianceCount: number;
  compliancePercent: number;
  complianceYes: number;
  complianceNo: number;
  latestRows: DashboardRow[];
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