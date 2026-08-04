import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { DashboardDailySnapshotRead, DashboardDailySnapshotWrite } from "@/generated/models/DashboardDailySnapshotModel";
import { DashboardDailySnapshotService } from "@/generated/services/DashboardDailySnapshotService";
import type { DayStatus } from "@/hooks/use-pillar-day-history";

export const REPRO_COMPLETE_EVENT = "amg:repro-complete-change";

export type DashboardDailySnapshotInput = {
  productionDate: string;
  safetyStatus: DayStatus | null;
  qualityStatus: DayStatus | null;
  processDeviationStatus: DayStatus | null;
  productDeviationStatus: DayStatus | null;
  productivityStatus: DayStatus | null;
  weeklyScrapPercent: number | null;
  processDeviationCount: number | null;
  processAffectedAreas: number | null;
  productDeviationCount: number | null;
  productAffectedAreas: number | null;
  buyoffCount: number;
  masterCardAvailable: number;
  masterCardTotal: number;
  masterCardAvailabilityPercent: number;
  reproCompleted: number;
  reproPercent: number;
  repeatedRejectionCount: number | null;
  openEscalationCount: number | null;
  longTermActionCount: number | null;
};

const WRITE_QUEUE = new Map<string, Promise<void>>();
const LAST_WRITTEN = new Map<string, string>();
const SNAPSHOT_QUERY_KEY = ["dashboard-daily-snapshot"] as const;

async function loadSnapshots(): Promise<DashboardDailySnapshotRead[]> {
  const result = await DashboardDailySnapshotService.getAll({
    top: 1000,
    orderBy: ["ProductionDate desc", "ID desc"],
  });
  if (!result.success) throw result.error ?? new Error("Could not read Dashboard Daily Snapshot");
  return result.data ?? [];
}

export function useDashboardDailySnapshotHistory() {
  const query = useQuery({
    queryKey: SNAPSHOT_QUERY_KEY,
    queryFn: loadSnapshots,
    refetchInterval: 60_000,
    refetchOnMount: "always",
  });
  const byDate = useMemo<Record<string, DashboardDailySnapshotRead>>(() => {
    const values: Record<string, DashboardDailySnapshotRead> = {};
    for (const row of query.data ?? []) {
      const day = (row.ProductionDate ?? "").slice(0, 10);
      if (day && !values[day]) values[day] = row;
    }
    return values;
  }, [query.data]);
  return { byDate, isLoading: query.isLoading, error: query.error };
}

function choice(status: DayStatus | null): string | undefined {
  if (status === "ok") return "Green";
  if (status === "warn") return "Yellow";
  if (status === "fail") return "Red";
  return undefined;
}

function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

function valuesFor(input: DashboardDailySnapshotInput): Omit<DashboardDailySnapshotWrite, "ID"> {
  const title = `DashboardSnapshot-${input.productionDate}`;
  return {
    Title: title,
    ProductionDate: input.productionDate,
    ...(choice(input.safetyStatus) ? { SafetyStatus: choice(input.safetyStatus) } : {}),
    ...(choice(input.qualityStatus) ? { QualityStatus: choice(input.qualityStatus) } : {}),
    ...(choice(input.processDeviationStatus)
      ? { ProcessDeviationStatus: choice(input.processDeviationStatus) }
      : {}),
    ...(choice(input.productDeviationStatus)
      ? { ProductDeviationStatus: choice(input.productDeviationStatus) }
      : {}),
    ...(choice(input.productivityStatus)
      ? { ProductivityStatus: choice(input.productivityStatus) }
      : {}),
    // These two spellings are the actual SharePoint internal column names.
    ...(input.weeklyScrapPercent != null
      ? { WeelyScrapPercent: round(input.weeklyScrapPercent) }
      : {}),
    ...(input.processDeviationCount != null
      ? { ProcessDeviationCount: input.processDeviationCount }
      : {}),
    ...(input.processAffectedAreas != null
      ? { ProcessAffectedAreas: input.processAffectedAreas }
      : {}),
    ...(input.productDeviationCount != null
      ? { ProductDeviationCount: input.productDeviationCount }
      : {}),
    ...(input.productAffectedAreas != null
      ? { ProductAffectedAreas: input.productAffectedAreas }
      : {}),
    BuyoffCount: input.buyoffCount,
    MasterCardAvailabe: input.masterCardAvailable,
    MasterCardTotal: input.masterCardTotal,
    MasterCardAvailabilityPercent: round(input.masterCardAvailabilityPercent),
    ReproCompleted: input.reproCompleted,
    ReproPercent: round(input.reproPercent),
    ...(input.repeatedRejectionCount != null
      ? { RepeatedRejectionCount: input.repeatedRejectionCount }
      : {}),
    ...(input.openEscalationCount != null
      ? { OpenEscalationCount: input.openEscalationCount }
      : {}),
    ...(input.longTermActionCount != null
      ? { LongTermActionCount: input.longTermActionCount }
      : {}),
    LastCalculated: new Date().toISOString(),
  };
}

function requireSuccess(result: { success: boolean; error?: unknown }, message: string): void {
  if (result.success) return;
  if (result.error instanceof Error) throw result.error;
  throw new Error(message);
}

async function upsertSnapshot(input: DashboardDailySnapshotInput): Promise<void> {
  const values = valuesFor(input);
  const title = values.Title ?? `DashboardSnapshot-${input.productionDate}`;
  const existing = await DashboardDailySnapshotService.getAll({
    filter: `Title eq '${escapeOData(title)}'`,
    top: 20,
    orderBy: ["ID desc"],
  });
  requireSuccess(existing, "Could not read Dashboard Daily Snapshot");

  const rows = (existing.data ?? []).filter((row) => row.ID != null);
  if (rows.length) {
    const results = await Promise.all(
      rows.map((row) => DashboardDailySnapshotService.update(String(row.ID), values)),
    );
    const failed = results.find((result) => !result.success);
    if (failed) requireSuccess(failed, "Could not update Dashboard Daily Snapshot");
    return;
  }

  const created = await DashboardDailySnapshotService.create(values);
  requireSuccess(created, "Could not create Dashboard Daily Snapshot");

  // SharePoint Choice values can be dropped during create by this connector.
  // A follow-up update makes the five status fields persist reliably.
  if (created.data?.ID != null) {
    const choices = {
      ...(values.SafetyStatus ? { SafetyStatus: values.SafetyStatus } : {}),
      ...(values.QualityStatus ? { QualityStatus: values.QualityStatus } : {}),
      ...(values.ProcessDeviationStatus
        ? { ProcessDeviationStatus: values.ProcessDeviationStatus }
        : {}),
      ...(values.ProductDeviationStatus
        ? { ProductDeviationStatus: values.ProductDeviationStatus }
        : {}),
      ...(values.ProductivityStatus ? { ProductivityStatus: values.ProductivityStatus } : {}),
    };
    const followUp = await DashboardDailySnapshotService.update(String(created.data.ID), choices);
    requireSuccess(followUp, "Could not save Dashboard Daily Snapshot statuses");
  }
}

function queueSnapshot(input: DashboardDailySnapshotInput): Promise<void> {
  const date = input.productionDate;
  const previous = WRITE_QUEUE.get(date) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => upsertSnapshot(input));
  WRITE_QUEUE.set(date, next);
  void next.finally(() => {
    if (WRITE_QUEUE.get(date) === next) WRITE_QUEUE.delete(date);
  });
  return next;
}

/**
 * Maintains one SharePoint summary row per production date. Writes are
 * debounced and only run when a dashboard value changes, so the app does not
 * update SharePoint on every render or clock tick.
 */
export function useDashboardDailySnapshotSync(input: DashboardDailySnapshotInput | null) {
  const [error, setError] = useState<Error | null>(null);
  const signature = input ? JSON.stringify(input) : "";

  useEffect(() => {
    if (!input || !input.productionDate || LAST_WRITTEN.get(input.productionDate) === signature) return;
    const timer = window.setTimeout(() => {
      void queueSnapshot(input)
        .then(() => {
          LAST_WRITTEN.set(input.productionDate, signature);
          setError(null);
        })
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? reason : new Error("Could not save Dashboard Daily Snapshot"));
        });
    }, 2_000);
    return () => window.clearTimeout(timer);
  // The serialized input is the change detector. Depending on the object
  // identity would restart the debounce on each dashboard clock render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return { error };
}
