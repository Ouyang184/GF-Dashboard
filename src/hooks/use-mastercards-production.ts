import { useQuery } from "@tanstack/react-query";

import { MastercardsService } from "@/generated/services/MastercardsService";

export type MastercardMonth = {
  month: string;
  year: number;
  count: number;
};

export type MastercardProductionRow = {
  /** YYYY-MM-DD */
  date: string;
  partNo: string;
};

export type MastercardsProductionData = {
  monthlyMastercards: MastercardMonth[];
  /** Every row in the fiscal window, for filtering a trend down to one part. */
  rows: MastercardProductionRow[];
  ytdProduced: number;
  fiscalYearStart: number;
  lastUpdatedAt: Date;
};

const REFRESH_MS = 5 * 60_000;
const FISCAL_START_MONTH = 10; // November, zero-indexed

function fiscalWindow(now = new Date()) {
  const startYear = now.getMonth() >= FISCAL_START_MONTH ? now.getFullYear() : now.getFullYear() - 1;
  return {
    startYear,
    start: new Date(Date.UTC(startYear, FISCAL_START_MONTH, 1)),
    end: new Date(Date.UTC(startYear + 1, FISCAL_START_MONTH, 1)),
  };
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function loadMastercardsProduction(): Promise<MastercardsProductionData> {
  const fiscal = fiscalWindow();
  const result = await MastercardsService.getAll({
    maxPageSize: 5000,
    top: 5000,
    filter: `Proc_Date ge '${fiscal.start.toISOString()}' and Proc_Date lt '${fiscal.end.toISOString()}'`,
    orderBy: ["Proc_Date asc"],
    select: ["ID", "Proc_Date", "Part_No", "Mold_Base_Number"],
  });

  if (!result.success) {
    throw result.error ?? new Error("SharePoint returned an unsuccessful Mastercards response");
  }

  const counts = new Map<string, number>();
  const rows: MastercardProductionRow[] = [];
  for (const row of result.data ?? []) {
    if (!row.Proc_Date) continue;
    const date = new Date(row.Proc_Date);
    if (Number.isNaN(date.getTime()) || date < fiscal.start || date >= fiscal.end) continue;
    const key = monthKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    rows.push({ date: date.toISOString().slice(0, 10), partNo: String(row.Part_No ?? "").trim() });
  }

  const monthlyMastercards = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(fiscal.startYear, FISCAL_START_MONTH + index, 1));
    return {
      month: date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      year: date.getUTCFullYear(),
      count: counts.get(monthKey(date)) ?? 0,
    };
  });

  return {
    monthlyMastercards,
    rows,
    ytdProduced: monthlyMastercards.reduce((sum, month) => sum + month.count, 0),
    fiscalYearStart: fiscal.startYear,
    lastUpdatedAt: new Date(),
  };
}

export function useMastercardsProduction() {
  const fiscal = fiscalWindow();
  const query = useQuery({
    queryKey: ["mastercards-production", fiscal.startYear],
    queryFn: loadMastercardsProduction,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isPending,
    error: query.error?.message ?? null,
  };
}
