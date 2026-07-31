import { useQuery } from "@tanstack/react-query";

import type { PRD_ApprovalsRead } from "@/generated/models/PRD_ApprovalsModel";
import { PRD_ApprovalsService } from "@/generated/services/PRD_ApprovalsService";
import type { DeviationExcelRow, ProcessDeviationData } from "@/hooks/use-process-deviations";

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && "Value" in value) {
    return text((value as { Value?: unknown }).Value);
  }
  return String(value).trim();
}

function normalizePart(value: unknown): string {
  return text(value).toUpperCase().replace(/\s+/g, "");
}

function normalizeMachine(value: unknown): string {
  const raw = text(value).toUpperCase().replace(/\s+/g, "");
  const numeric = raw.match(/\d+/)?.[0];
  return numeric ? numeric.replace(/^0+/, "") || "0" : raw;
}

function dateOnly(value: unknown): string {
  const date = new Date(text(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function isClosedDecision(value: unknown): boolean {
  return ["rejected", "reject", "cancelled", "canceled", "closed", "complete", "completed"].includes(
    text(value).toLowerCase(),
  );
}

async function loadProcessDeviations(): Promise<ProcessDeviationData> {
  const deviationResult = await PRD_ApprovalsService.getAll({
    top: 1000,
    maxPageSize: 500,
    orderBy: ["Created desc"],
    select: ["ID", "Title", "PRD_Number", "Part_No", "Machine_ID", "field_3", "Created"],
  });
  if (!deviationResult.success) {
    throw deviationResult.error ?? new Error("Could not read Process Deviations from SharePoint");
  }

  const latestByPrd = new Map<string, PRD_ApprovalsRead>();
  for (const row of deviationResult.data ?? []) {
    const prd = text(row.PRD_Number || row.Title);
    if (prd && !latestByPrd.has(prd)) latestByPrd.set(prd, row);
  }

  const processParts = new Set<string>();
  const processMachines = new Set<string>();
  const rows: DeviationExcelRow[] = [];
  for (const row of latestByPrd.values()) {
    const part = normalizePart(row.Part_No);
    // PRD_Approvals.Machine_ID contains the actual floor machine number
    // (for example 423 or 222), not the SharePoint ID of a Machines-list row.
    const machine = normalizeMachine(row.Machine_ID);
    if (!part && !machine) continue;
    const closed = isClosedDecision(row.field_3);
    rows.push({
      kind: "process",
      part,
      machine,
      deviationNumber: text(row.PRD_Number || row.Title),
      detail: text(row.field_3),
      dateRequested: dateOnly(row.Created),
      closed,
    });
    if (!closed) {
      if (part) processParts.add(part);
      if (machine) processMachines.add(machine);
    }
  }

  return {
    processParts: [...processParts],
    processMachines: [...processMachines],
    productParts: [],
    rows,
  };
}

export function useProcessDeviationList() {
  return useQuery({
    queryKey: ["process-deviations", "prd-approvals"],
    queryFn: loadProcessDeviations,
    refetchInterval: 60_000,
    refetchOnMount: "always",
  });
}
