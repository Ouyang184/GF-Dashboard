import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { MoldingBuyoffStructureRead } from "@/generated/models/MoldingBuyoffStructureModel";
import { MoldingBuyoffStructureService } from "@/generated/services/MoldingBuyoffStructureService";

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
  machine: string;
  jobCount: number;
  status?: string;
  color?: string;
  worstStatus?: "matching" | "comparable" | "missing";
  jobs: FloorMapJob[];
};

export type DashboardData = {
  updatedAt: string;
  latestDate: string;
  productionDate: string;
  productionWindowStart: string;
  productionWindowEnd: string;
  reportingPeriod?: "week" | "production-day" | "month";
  machinesRunning: number;
  buyOffCount: number;
  totalRows: number;
  rawRowsInWindow?: number;
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
  complianceSubtitle: string;
  complianceDenominator: number;
  reproComplete: number | null;
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
  missingRows: DashboardRow[];
  machineJobs?: DashboardRow[];
  floorMap?: FloorMapEntry[] | Record<string, FloorMapEntry>;
  monthlyMastercards?: { month: string; count: number }[];
  ytdProduced?: number;
  fiscalYearStart?: number;
};

export type DashboardState = {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: Date | null;
};

export type DashboardPeriod = "production-day" | "month" | "previous-month";

type WindowInfo = {
  start: Date;
  end: Date;
  productionDate: string;
  reportingPeriod: "week" | "production-day" | "month";
};

type NormalizedRow = DashboardRow & { created: Date };

const REFRESH_MS = 60_000;

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && "Value" in value) {
    return text((value as { Value?: unknown }).Value);
  }
  return String(value).trim();
}

function percent(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0;
}

function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function reportingWindow(now = new Date()): WindowInfo {
  const isMonday = now.getDay() === 1;
  const end = new Date(now);

  if (isMonday) {
    // Monday reports the last completed Friday production day:
    // Friday 7 AM through Saturday 7 AM.
    end.setDate(end.getDate() - 2);
    end.setHours(7, 0, 0, 0);
  } else {
    end.setHours(7, 0, 0, 0);
    if (now < end) end.setDate(end.getDate() - 1);
  }

  const start = new Date(end);
  start.setDate(start.getDate() - 1);

  return {
    start,
    end,
    productionDate: dateOnly(start),
    reportingPeriod: "production-day",
  };
}

export function dashboardWindow(
  period: DashboardPeriod = "production-day",
  now = new Date(),
  productionDate?: string | null,
): WindowInfo {
  if (period === "production-day") {
    if (productionDate?.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = productionDate.split("-").map(Number);
      const start = new Date(year, month - 1, day, 7, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end, productionDate, reportingPeriod: "production-day" };
    }
    return reportingWindow(now);
  }
  const monthOffset = period === "previous-month" ? -1 : 0;
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1, 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);
  return {
    start,
    end,
    productionDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    reportingPeriod: "month",
  };
}

function normalizeMachine(machine: string): string {
  return machine.toUpperCase().replace(/IMM?/g, "").replace(/\s+/g, "").trim();
}

function mcStatus(value: string): "matching" | "comparable" | "missing" {
  const normalized = value.toLowerCase();
  if (normalized === "yes") return "matching";
  if (normalized === "comparable") return "comparable";
  return "missing";
}

function isAccepted(value: string): boolean {
  return ["yes", "y", "true", "accepted", "overall accepted", "overall acceptance", "pass", "passed"].includes(
    value.toLowerCase(),
  );
}

function normalizeRow(row: MoldingBuyoffStructureRead): NormalizedRow | null {
  const rawDate = row.Created || row.DateCreated;
  const created = rawDate ? new Date(rawDate) : null;
  if (!created || Number.isNaN(created.getTime())) return null;

  return {
    id: Number(row.ID ?? 0),
    dateCreated: text(row.DateCreated || row.Created),
    workOrder: text(row.WorkOrder_x0023_),
    machine: text(row.Machine_x0023_),
    partNumber: text(row.Part_x0023_),
    partDescription: text(row.PartDescription),
    restartMoldChange: text(row.Restart_x002f_MoldChange_x003f_),
    productionTech: text(row.MoldingTech),
    overallAcceptance: text(row.BuyOffAccepted_x003f_),
    masterCard: text(row.MasterCard),
    created,
  };
}

function buildDashboard(
  records: MoldingBuyoffStructureRead[],
  period: DashboardPeriod = "production-day",
  productionDate?: string | null,
): DashboardData {
  const window = dashboardWindow(period, new Date(), productionDate);
  // Record 4372 is an invalid placeholder row (machine "NANANAN",
  // Fastlock Insert) and must not affect Productivity KPIs or tables.
  const excludedRecordIds = new Set([4372]);
  const allRows = records
    .map(normalizeRow)
    .filter((row): row is NormalizedRow => row !== null && !excludedRecordIds.has(row.id));
  const rowsInWindow = allRows.filter((row) => row.created >= window.start && row.created < window.end);

  const latestByMachinePart = new Map<string, NormalizedRow>();
  rowsInWindow
    .slice()
    .sort((a, b) => a.created.getTime() - b.created.getTime())
    .forEach((row) => {
      if (!row.machine || !row.partNumber) return;
      latestByMachinePart.set(`${row.machine}|${row.partNumber}`, row);
    });

  const jobRows = [...latestByMachinePart.values()];

  // Buy Offs = unique Machine + Part jobs where Buyoff Accepted is explicitly "Yes".
  // Blank/missing Buyoff Accepted is intentionally NOT counted here.
  const buyOffRows = jobRows.filter((row) => row.overallAcceptance.toLowerCase() === "yes");

  // MasterCard breakdown, MC Available, and Compliance are all scoped to Buy Off
  // rows only — a job that was never accepted isn't part of these stats.
  const matchingRows = buyOffRows.filter((row) => mcStatus(row.masterCard) === "matching");
  const comparableRows = buyOffRows.filter((row) => mcStatus(row.masterCard) === "comparable");
  const missingBuyOffRows = buyOffRows.filter((row) => mcStatus(row.masterCard) === "missing");
  const availableRows = [...matchingRows, ...comparableRows];

  const machines = new Map<string, NormalizedRow[]>();
  jobRows.forEach((row) => {
    const machine = normalizeMachine(row.machine);
    if (!machine) return;
    machines.set(machine, [...(machines.get(machine) ?? []), row]);
  });

  const floorMap: FloorMapEntry[] = [...machines.entries()].map(([machine, jobs]) => {
    const statuses = jobs.map((job) => mcStatus(job.masterCard));
    const worstStatus = statuses.includes("missing")
      ? "missing"
      : statuses.includes("comparable")
        ? "comparable"
        : "matching";
    return {
      machine,
      jobCount: jobs.length,
      status: worstStatus === "missing" ? "Missing MC" : worstStatus === "comparable" ? "Comparable" : "Matching",
      color: worstStatus === "missing" ? "red" : worstStatus === "comparable" ? "yellow" : "green",
      worstStatus,
      jobs: jobs.map((job) => ({ ...job, status: mcStatus(job.masterCard) })),
    };
  });

  const latestRecord = allRows.slice().sort((a, b) => b.created.getTime() - a.created.getTime())[0];
  const total = jobRows.length;
  const buyOffCount = buyOffRows.length;
  const available = availableRows.length;
  // Compliance is now the same figure as MC Available, since the base population
  // (Buy Off rows) is already Buyoff Accepted = Yes. Kept as its own stat for continuity.
  const compliance = available;
  const cleanRows = (rows: NormalizedRow[]): DashboardRow[] =>
    rows.map(({ created: _created, ...row }) => row);
  const isCalendarMonth = window.reportingPeriod === "month";
  const displayWindowEnd = isCalendarMonth
    ? new Date(window.end.getTime() - 1)
    : window.end;

  return {
    updatedAt: new Date().toLocaleString("en-US"),
    latestDate: latestRecord ? dateOnly(latestRecord.created) : "",
    productionDate: window.productionDate,
    productionWindowStart: isCalendarMonth
      ? window.start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : window.start.toLocaleString("en-US"),
    productionWindowEnd: isCalendarMonth
      ? displayWindowEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : displayWindowEnd.toLocaleString("en-US"),
    reportingPeriod: window.reportingPeriod,
    machinesRunning: total,
    buyOffCount,
    totalRows: total,
    rawRowsInWindow: rowsInWindow.length,
    mcAvailableCount: available,
    mcAvailablePercent: percent(available, buyOffCount),
    matchingCount: matchingRows.length,
    matchingPercent: percent(matchingRows.length, buyOffCount),
    comparableCount: comparableRows.length,
    comparablePercent: percent(comparableRows.length, buyOffCount),
    missingCount: missingBuyOffRows.length,
    missingPercent: percent(missingBuyOffRows.length, buyOffCount),
    complianceCount: compliance,
    compliancePercent: percent(compliance, buyOffCount),
    complianceSubtitle: `${compliance} of ${buyOffCount} available MC · Buyoff Accepted`,
    complianceDenominator: buyOffCount,
    reproComplete: null,
    availabilityCount: compliance,
    availabilityPercent: percent(compliance, buyOffCount),
    mastercardYes: matchingRows.length,
    mastercardComparable: comparableRows.length,
    mastercardNo: missingBuyOffRows.length,
    complianceYes: compliance,
    complianceNo: Math.max(buyOffCount - compliance, 0),
    matching: matchingRows.length,
    comparable: comparableRows.length,
    missing: missingBuyOffRows.length,
    latestRows: cleanRows(buyOffRows.slice().sort((a, b) => b.id - a.id)),
    missingRows: cleanRows(missingBuyOffRows),
    machineJobs: cleanRows(jobRows),
    floorMap,
  };
}

function getBaseUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_API_BASE_URL ?? "http://localhost:3001";
}

async function loadLocalApi(signal: AbortSignal): Promise<DashboardData> {
  const response = await fetch(`${getBaseUrl()}/api/dashboard`, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Local dashboard API ${response.status}`);
  return response.json() as Promise<DashboardData>;
}

async function loadSharePoint(period: DashboardPeriod, productionDate?: string | null): Promise<DashboardData> {
  const window = dashboardWindow(period, new Date(), productionDate);
  const result = await MoldingBuyoffStructureService.getAll({
    maxPageSize: 500,
    top: period === "production-day" ? 1000 : 5000,
    filter: `Created ge '${window.start.toISOString()}' and Created lt '${window.end.toISOString()}'`,
    orderBy: ["Created desc"],
    select: [
      "ID",
      "DateCreated",
      "Created",
      "WorkOrder_x0023_",
      "Machine_x0023_",
      "Part_x0023_",
      "PartDescription",
      "Restart_x002f_MoldChange_x003f_",
      "MoldingTech",
      "BuyOffAccepted_x003f_",
      "MasterCard",
    ],
  });

  if (!result.success) {
    throw result.error ?? new Error("SharePoint returned an unsuccessful response");
  }
  return buildDashboard(result.data ?? [], period, productionDate);
}

async function loadDashboard(signal: AbortSignal, period: DashboardPeriod, productionDate?: string | null): Promise<DashboardData> {
  try {
    return await loadSharePoint(period, productionDate);
  } catch (connectorError) {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      throw connectorError;
    }
    if (period !== "production-day") throw connectorError;
    return loadLocalApi(signal);
  }
}

export function useDashboardData(period: DashboardPeriod = "production-day", productionDate?: string | null): DashboardState {
  const window = dashboardWindow(period, new Date(), productionDate);
  const query = useQuery({
    queryKey: ["molding-buyoff-dashboard", period, window.productionDate],
    queryFn: ({ signal }) => loadDashboard(signal, period, productionDate),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isPending,
    error: query.error
      ? query.error.message || "Failed to load Productivity data from SharePoint"
      : null,
    lastFetchedAt: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
  };
}

export function useMarkMasterCardCreated() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      // The generated MasterCard pseudo-lookup endpoint returns 404 on this
      // SharePoint list. Resolve the lookup ID from an existing row whose
      // MasterCard value is already Yes instead.
      const samples = await MoldingBuyoffStructureService.getAll({
        top: 500,
        orderBy: ["ID desc"],
        select: ["ID", "MasterCard"],
      });
      if (!samples.success) {
        const detail =
          samples.error instanceof Error
            ? samples.error.message
            : JSON.stringify(samples.error ?? "unknown connector error");
        throw new Error(`SharePoint could not read existing MasterCard values: ${detail}`);
      }
      const yesRow = (samples.data ?? []).find((row) => {
        const value = row.MasterCard;
        const label =
          value && typeof value === "object" && "Value" in value
            ? String(value.Value ?? "")
            : String(value ?? "");
        return label.trim().toLowerCase() === "yes";
      });
      const yesValue = yesRow?.MasterCard;
      const yesId = Number(
        yesValue && typeof yesValue === "object" && "Id" in yesValue
          ? yesValue.Id
          : Number.NaN,
      );
      if (!Number.isFinite(yesId)) {
        throw new Error(
          'No existing SharePoint row exposed the lookup ID for MasterCard = "Yes".',
        );
      }

      const result = await MoldingBuyoffStructureService.update(String(id), {
        // The connector schema defines MasterCard as a writable object even
        // though its generated TypeScript write model incorrectly says
        // string. Reuse the exact object shape returned by a known Yes row.
        MasterCard: yesValue as unknown as string,
      });
      if (!result.success) {
        const detail =
          result.error instanceof Error
            ? result.error.message
            : JSON.stringify(result.error ?? "unknown connector error");
        throw new Error(`SharePoint did not update record ${id}: ${detail}`);
      }

      // Verify the persisted SharePoint value instead of trusting the
      // connector's success flag, which can be returned for ignored fields.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 1_000));
        }
        const saved = await MoldingBuyoffStructureService.get(String(id));
        if (!saved.success) continue;
        const value = saved.data?.MasterCard;
        const label =
          value && typeof value === "object" && "Value" in value
            ? String(value.Value ?? "")
            : String(value ?? "");
        if (label.trim().toLowerCase() === "yes") return id;
      }
      throw new Error("SharePoint accepted the request but the MasterCard column did not change to Yes");
    },
    onSuccess: (id) => {
      queryClient.setQueriesData<DashboardData>(
        { queryKey: ["molding-buyoff-dashboard"] },
        (current) => {
          if (!current) return current;
          const existing = current.missingRows?.find((row) => row.id === id);
          if (!existing) return current;
          const updated = { ...existing, masterCard: "Yes" };
          const available = current.mcAvailableCount + 1;
          const matching = current.matchingCount + 1;
          return {
            ...current,
            updatedAt: new Date().toLocaleString("en-US"),
            missingRows: (current.missingRows ?? []).filter((row) => row.id !== id),
            latestRows: [
              updated,
              ...(current.latestRows ?? []).filter((row) => row.id !== id),
            ].sort((a, b) => b.id - a.id),
            machineJobs: (current.machineJobs ?? []).map((row) =>
              row.id === id ? updated : row,
            ),
            mcAvailableCount: available,
            mcAvailablePercent: percent(available, current.buyOffCount),
            matchingCount: matching,
            matchingPercent: percent(matching, current.buyOffCount),
            missingCount: Math.max(current.missingCount - 1, 0),
            missingPercent: percent(Math.max(current.missingCount - 1, 0), current.buyOffCount),
            complianceCount: available,
            compliancePercent: percent(available, current.buyOffCount),
            complianceSubtitle: `${available} of ${current.buyOffCount} available MC · Buyoff Accepted`,
            availabilityCount: available,
            availabilityPercent: percent(available, current.buyOffCount),
            mastercardYes: current.mastercardYes + 1,
            mastercardNo: Math.max(current.mastercardNo - 1, 0),
            complianceYes: available,
            complianceNo: Math.max(current.buyOffCount - available, 0),
            matching,
            missing: Math.max((current.missing ?? current.missingCount) - 1, 0),
          };
        },
      );
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["molding-buyoff-dashboard"] });
      }, 15_000);
    },
  });
}
