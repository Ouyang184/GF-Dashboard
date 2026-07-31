import { useQuery } from "@tanstack/react-query";

import type { Coils_CollarsBuyoffStructureRead } from "@/generated/models/Coils_CollarsBuyoffStructureModel";
import { ExtrusionService } from "@/generated/services/ExtrusionService";
import { reportingWindow } from "@/hooks/use-dashboard-data";
import type { PafBuyoff } from "@/hooks/use-paf-buyoffs";

function text(value: unknown): string {
  if (value && typeof value === "object" && "Value" in value) {
    return text((value as { Value?: unknown }).Value);
  }
  return String(value ?? "").trim();
}

function normalize(row: Coils_CollarsBuyoffStructureRead): PafBuyoff {
  return {
    id: Number(row.ID ?? 0),
    date: text(row.DateCreated || row.Created),
    timeIn: text(row.TimeIn),
    workOrder: text(row.WorkOrder_x0023_),
    machine: text(row.Machine_x0023_),
    partNumber: text(row.Part_x0023_),
    partDescription: text(row.PartDescription),
    buyoffType: text(row.BuyoffType),
    acceptance: text(row.Overall_x0020_Acceptance || row.BuyOffAccepted_x003f_),
    shift: text(row.Shift),
    qcTech: text(
      row.QCTech ||
        row.QCTech_x0028_Visual_x0029_ ||
        row.QCTech_x0028_Dimensional_x0029_,
    ),
  };
}

async function loadExtrusionBuyoffs(): Promise<PafBuyoff[]> {
  const window = reportingWindow();
  const result = await ExtrusionService.getAll({
    maxPageSize: 500,
    top: 500,
    filter: `Created ge '${window.start.toISOString()}' and Created lt '${window.end.toISOString()}'`,
    orderBy: ["Created desc"],
  });
  if (!result.success) throw result.error ?? new Error("Could not read Extrusion buyoffs");
  return (result.data ?? []).map(normalize).sort((a, b) => b.id - a.id);
}

export function useExtrusionBuyoffs() {
  return useQuery({
    queryKey: ["extrusion-buyoffs"],
    queryFn: loadExtrusionBuyoffs,
    refetchInterval: 60_000,
  });
}
