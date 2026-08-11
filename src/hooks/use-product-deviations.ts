import { useQuery } from "@tanstack/react-query";

import type { DB_DeviationAppRead } from "@/generated/models/DB_DeviationAppModel";
import type { MoldingBuyoffStructureRead } from "@/generated/models/MoldingBuyoffStructureModel";
import { DB_DeviationAppService } from "@/generated/services/DB_DeviationAppService";
import { MoldingBuyoffStructureService } from "@/generated/services/MoldingBuyoffStructureService";
import type { DeviationExcelRow } from "@/hooks/use-process-deviations";

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

function dateOnly(value: unknown): string {
  const date = new Date(text(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function dayDistance(left: string, right: string): number {
  const leftDate = new Date(`${left}T12:00:00`);
  const rightDate = new Date(`${right}T12:00:00`);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return Number.POSITIVE_INFINITY;
  return Math.abs(leftDate.getTime() - rightDate.getTime()) / 86_400_000;
}

function isClosed(row: DB_DeviationAppRead): boolean {
  const active = text(row.CurrentlyActive_x003f_).toLowerCase();
  const cancellation = text(row.CancellationStatus).toLowerCase();
  if (["no", "false", "inactive", "closed"].includes(active)) return true;
  if (row.CloseDate) return true;
  return ["cancelled", "canceled", "closed"].includes(cancellation);
}

export type ProductDeviationData = {
  productParts: string[];
  rows: DeviationExcelRow[];
};

async function loadProductDeviations(): Promise<ProductDeviationData> {
  const result = await DB_DeviationAppService.getAll({
    top: 1000,
    maxPageSize: 500,
    orderBy: ["Created desc"],
    select: [
      "ID",
      "Title",
      "Date",
      "Created",
      "WorkOrderNumber",
      "PartNumber",
      "PartDescription",
      "DeviationNumber",
      "ExplanationofReason_x0028_s_x002",
      "DeviationNotes",
      "CurrentlyActive_x003f_",
      "CloseDate",
      "CancellationStatus",
    ],
  });
  if (!result.success) {
    throw result.error ?? new Error("Could not read Product Deviations from SharePoint");
  }

  const sourceRows = result.data ?? [];
  const requestedDates = sourceRows
    .map((row) => dateOnly(row.Date || row.Created))
    .filter(Boolean)
    .sort();
  const buyoffRows: MoldingBuyoffStructureRead[] = [];
  if (requestedDates.length) {
    const rangeStart = new Date(`${requestedDates[0]}T00:00:00`);
    const rangeEnd = new Date(`${requestedDates[requestedDates.length - 1]}T00:00:00`);
    rangeStart.setDate(rangeStart.getDate() - 2);
    rangeEnd.setDate(rangeEnd.getDate() + 3);
    const buyoffResult = await MoldingBuyoffStructureService.getAll({
      top: 1000,
      maxPageSize: 500,
      filter: `Created ge '${rangeStart.toISOString()}' and Created lt '${rangeEnd.toISOString()}'`,
      orderBy: ["Created desc"],
      select: ["ID", "Created", "DateCreated", "WorkOrder_x0023_", "Machine_x0023_"],
    });
    if (buyoffResult.success) buyoffRows.push(...(buyoffResult.data ?? []));
  }

  const activeParts = new Set<string>();
  const rows: DeviationExcelRow[] = [];
  for (const row of sourceRows) {
    const deviationNumber = text(row.DeviationNumber || row.Title) || `SharePoint-${row.ID ?? "unknown"}`;
    const part = normalizePart(row.PartNumber);
    const closed = isClosed(row);
    const workOrder = text(row.WorkOrderNumber).toUpperCase().replace(/\s+/g, "");
    const requestedDate = dateOnly(row.Date || row.Created);
    const buyoffMatch = workOrder
      ? buyoffRows
          .map((buyoff) => ({
            row: buyoff,
            distance: dayDistance(requestedDate, dateOnly(buyoff.DateCreated || buyoff.Created)),
          }))
          .filter(
            (candidate) =>
              text(candidate.row.WorkOrder_x0023_).toUpperCase().replace(/\s+/g, "") === workOrder &&
              candidate.distance <= 2,
          )
          .sort((a, b) => a.distance - b.distance)[0]?.row
      : undefined;
    rows.push({
      kind: "product",
      part,
      machine: text(buyoffMatch?.Machine_x0023_),
      workOrder,
      deviationNumber,
      description: text(row.PartDescription),
      detail: [text(row.ExplanationofReason_x0028_s_x002), text(row.DeviationNotes)]
        .filter(Boolean)
        .join(" · "),
      dateRequested: requestedDate,
      closed,
    });
    if (!closed && part) activeParts.add(part);
  }

  return { productParts: [...activeParts], rows };
}

export function useProductDeviations() {
  return useQuery({
    queryKey: ["product-deviations", "db-deviation-app"],
    queryFn: loadProductDeviations,
    refetchInterval: 60_000,
    refetchOnMount: "always",
  });
}
