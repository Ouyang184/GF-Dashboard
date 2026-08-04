import { useQuery } from "@tanstack/react-query";

import type { Coils_CollarsBuyoffStructureRead } from "@/generated/models/Coils_CollarsBuyoffStructureModel";
import { Coils_CollarsBuyoffStructureService } from "@/generated/services/Coils_CollarsBuyoffStructureService";
import { dashboardWindow, type DashboardPeriod } from "@/hooks/use-dashboard-data";

export type PafBuyoff = {
  id: number;
  date: string;
  timeIn: string;
  workOrder: string;
  machine: string;
  partNumber: string;
  partDescription: string;
  buyoffType: string;
  acceptance: string;
  shift: string;
  qcTech: string;
};

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
    qcTech: text(row.QCTech || row.QCTech_x0028_Visual_x0029_ || row.QCTech_x0028_Dimensional_x0029_),
  };
}

async function loadPafBuyoffs(period: DashboardPeriod, productionDate?: string | null): Promise<PafBuyoff[]> {
  const window = dashboardWindow(period, new Date(), productionDate);
  const result = await Coils_CollarsBuyoffStructureService.getAll({
    maxPageSize: 500,
    top: period === "production-day" ? 500 : 5000,
    filter: `Created ge '${window.start.toISOString()}' and Created lt '${window.end.toISOString()}'`,
    orderBy: ["Created desc"],
  });
  if (!result.success) throw result.error ?? new Error("Could not read PAF Buyoff Structure");
  return (result.data ?? []).map(normalize).sort((a, b) => b.id - a.id);
}

export function usePafBuyoffs(period: DashboardPeriod = "production-day", productionDate?: string | null) {
  const window = dashboardWindow(period, new Date(), productionDate);
  return useQuery({
    queryKey: ["paf-buyoff-structure", period, window.productionDate],
    queryFn: () => loadPafBuyoffs(period, productionDate),
    refetchInterval: 60_000,
  });
}
