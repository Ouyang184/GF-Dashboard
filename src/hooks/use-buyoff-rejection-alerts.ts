import { useQuery } from "@tanstack/react-query";

import type { MoldingBuyoffStructureRead } from "@/generated/models/MoldingBuyoffStructureModel";
import { MoldingBuyoffStructureService } from "@/generated/services/MoldingBuyoffStructureService";
import { MoldingBuyoffRejectionLogsService } from "@/generated/services/MoldingBuyoffRejectionLogsService";

export type BuyoffRejectionAlert = {
  key: string;
  machine: string;
  partNumber: string;
  rejectionCount: number;
  latestRejection: string;
};

type RejectionGroup = {
  machine: string;
  partNumber: string;
  dates: Date[];
  ids: number[];
};

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && "Value" in value) return text((value as { Value?: unknown }).Value);
  return String(value).trim();
}

function isRejected(value: unknown): boolean {
  return ["no", "rejected", "reject", "fail", "failed", "false", "not accepted"].includes(text(value).toLowerCase());
}

function isAccepted(value: unknown): boolean {
  return ["yes", "accepted", "pass", "passed", "true"].includes(text(value).toLowerCase());
}

function rowIsRejected(row: MoldingBuyoffStructureRead): boolean {
  const overall = row.All_x0020_3_x0020__x0022_Yes_x00;
  if (isRejected(overall)) return true;
  if (isAccepted(overall)) return false;
  return [
    row.BuyOffAccepted_x003f_,
    row.BuyoffAccepted_x0028_Mechanical_,
    row.BuyoffAccepted_x0028_Dimensional,
    row.BuyoffAccepted_x0028_Visual_x002,
  ].some(isRejected);
}

function rowDate(row: MoldingBuyoffStructureRead): Date | null {
  const value = row.Created || row.DateCreated;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function alertTitle(machine: string, partNumber: string, count: number): string {
  return `Machine ${machine} · Part ${partNumber} — ${count} rejections in 24h`;
}

async function loadActiveGroups(): Promise<Map<string, RejectionGroup>> {
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const result = await MoldingBuyoffStructureService.getAll({
    maxPageSize: 500,
    top: 1000,
    filter: `Created ge '${since.toISOString()}'`,
    orderBy: ["Created desc"],
    select: [
      "ID",
      "Created",
      "DateCreated",
      "Machine_x0023_",
      "Part_x0023_",
      "All_x0020_3_x0020__x0022_Yes_x00",
      "BuyOffAccepted_x003f_",
      "BuyoffAccepted_x0028_Mechanical_",
      "BuyoffAccepted_x0028_Dimensional",
      "BuyoffAccepted_x0028_Visual_x002",
    ],
  });
  if (!result.success) throw result.error ?? new Error("Could not check rejected buyoffs");

  const groups = new Map<string, RejectionGroup>();
  for (const row of result.data ?? []) {
    if (!rowIsRejected(row)) continue;
    const date = rowDate(row);
    if (!date || date < since) continue;
    const machine = text(row.Machine_x0023_);
    const partNumber = text(row.Part_x0023_);
    if (!machine || !partNumber) continue;
    const key = `${machine.toUpperCase()}|${partNumber.toUpperCase()}`;
    const group = groups.get(key) ?? { machine, partNumber, dates: [], ids: [] };
    group.dates.push(date);
    if (row.ID != null) group.ids.push(row.ID);
    groups.set(key, group);
  }
  return groups;
}

/**
 * Keeps the "Molding Buyoff Rejection Logs" SharePoint list in sync with the
 * live 24h rejection check: opens (or updates in place) a log row while a
 * machine+part pair is actively double-rejecting, and flips it to Resolved
 * once it drops out of the rolling window. Fire-and-forget from loadAlerts —
 * logging failures must never block the on-screen alert banner.
 */
async function syncRejectionLogs(activeGroups: Map<string, RejectionGroup>): Promise<void> {
  const openResult = await MoldingBuyoffRejectionLogsService.getAll({
    filter: "AlertStatus eq 'Open'",
    top: 200,
  });
  if (!openResult.success) return;
  const openLogs = openResult.data ?? [];

  const matchLog = (machine: string, partNumber: string) =>
    openLogs.find(
      (log) =>
        (log.MachineNumber ?? "").trim().toUpperCase() === machine.toUpperCase() &&
        (log.PartNumber ?? "").trim().toUpperCase() === partNumber.toUpperCase()
    );

  const seenLogIds = new Set<number>();

  for (const group of activeGroups.values()) {
    const first = new Date(Math.min(...group.dates.map((d) => d.getTime())));
    const latest = new Date(Math.max(...group.dates.map((d) => d.getTime())));
    const sourceIds = group.ids.join(", ");
    const existing = matchLog(group.machine, group.partNumber);

    if (existing) {
      if (existing.ID != null) seenLogIds.add(existing.ID);
      const countChanged = existing.RejectionCount24Hours !== group.dates.length;
      const latestChanged = existing.LatestRejectionDateTime !== latest.toISOString();
      if (existing.ID != null && (countChanged || latestChanged)) {
        await MoldingBuyoffRejectionLogsService.update(String(existing.ID), {
          RejectionCount24Hours: group.dates.length,
          LatestRejectionDateTime: latest.toISOString(),
          SourceRecordIDs: sourceIds,
          Title: alertTitle(group.machine, group.partNumber, group.dates.length),
        }).catch(() => {});
      }
    } else {
      await MoldingBuyoffRejectionLogsService.create({
        Title: alertTitle(group.machine, group.partNumber, group.dates.length),
        MachineNumber: group.machine,
        PartNumber: group.partNumber,
        FirstRejectionDateTime: first.toISOString(),
        LatestRejectionDateTime: latest.toISOString(),
        RejectionCount24Hours: group.dates.length,
        AlertStatus: "Open",
        SourceRecordIDs: sourceIds,
        AlertCreatedDateTime: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  // Any open log whose machine+part no longer has 2+ rejections in the
  // current rolling window has cleared — close it out automatically.
  for (const log of openLogs) {
    if (log.ID == null || seenLogIds.has(log.ID)) continue;
    await MoldingBuyoffRejectionLogsService.update(String(log.ID), { AlertStatus: "Resolved" }).catch(() => {});
  }
}

async function loadAlerts(): Promise<BuyoffRejectionAlert[]> {
  const groups = await loadActiveGroups();
  const activeGroups = new Map([...groups.entries()].filter(([, group]) => group.dates.length >= 2));

  // Best-effort: don't let the SharePoint log sync delay or break the banner.
  syncRejectionLogs(activeGroups).catch(() => {});

  return [...activeGroups.entries()]
    .map(([key, group]) => ({
      key,
      machine: group.machine,
      partNumber: group.partNumber,
      rejectionCount: group.dates.length,
      latestRejection: new Date(Math.max(...group.dates.map((date) => date.getTime()))).toISOString(),
    }))
    .sort((a, b) => b.rejectionCount - a.rejectionCount || b.latestRejection.localeCompare(a.latestRejection));
}

export function useBuyoffRejectionAlerts() {
  return useQuery({
    queryKey: ["buyoff-rejection-alerts", "rolling-24-hours"],
    queryFn: loadAlerts,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
}
