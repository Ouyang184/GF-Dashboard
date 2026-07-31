import { useQuery } from "@tanstack/react-query";

import { ExcelOnline_Business_Service } from "@/generated/services/ExcelOnline_Business_Service";

const SITE_URL = "https://georgfischer.sharepoint.com/sites/GFPS-AMGManufacturingEngineering";
const FOLDER_PATH = ["Documentation", "T2"] as const;
const WORKBOOK_NAME = "Document Number.xlsm";

function records(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  for (const key of ["value", "Value", "items", "Items"]) {
    if (Array.isArray(object[key])) return records(object[key]);
  }
  return [];
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function id(value: Record<string, unknown>): string {
  return text(value.Id ?? value.id ?? value.ID);
}

function name(value: Record<string, unknown>): string {
  return text(value.Name ?? value.name ?? value.DisplayName ?? value.displayName);
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rowValue(row: Record<string, unknown>, wanted: string): unknown {
  const match = Object.keys(row).find((key) => {
    const normalized = normalizeHeader(key);
    return normalized === wanted ||
      (wanted === "machine" && normalized.startsWith("machin")) ||
      (wanted === "part" && normalized.startsWith("part"));
  });
  return match ? row[match] : undefined;
}

function normalizeMachine(value: unknown): string {
  const raw = text(value).toUpperCase().replace(/\s+/g, "");
  const numeric = raw.match(/\d+/)?.[0];
  return numeric ? numeric.replace(/^0+/, "") || "0" : raw;
}

/** Excel dates come back as ISO 8601 strings (per the "ISO 8601" dateTimeFormat below); reduce to YYYY-MM-DD. */
function parseDateOnly(value: unknown): string {
  const s = text(value);
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function unwrap(row: Record<string, unknown>): Record<string, unknown> {
  const dynamic = row.dynamicProperties;
  return dynamic && typeof dynamic === "object"
    ? dynamic as Record<string, unknown>
    : row;
}

/** One raw row from the Excel deviation tables, kept for date-based (e.g. "yesterday") lookups. */
export type DeviationExcelRow = {
  kind: "process" | "product";
  part: string;
  machine: string;
  workOrder?: string;
  deviationNumber?: string;
  description?: string;
  detail?: string;
  /** YYYY-MM-DD from the "Date Requested" column, or "" if missing/unparseable. */
  dateRequested: string;
  closed: boolean;
};

export type ProcessDeviationData = {
  processParts: string[];
  processMachines: string[];
  productParts: string[];
  /** Every row seen (open or closed), for filtering by Date Requested. */
  rows: DeviationExcelRow[];
};

async function loadActiveProcessDeviations(): Promise<ProcessDeviationData> {
  const drives = await ExcelOnline_Business_Service.GetDrives(SITE_URL);
  if (!drives.success) throw drives.error ?? new Error("Could not read the SharePoint document libraries");
  const driveList = records(drives.data);
  const drive =
    driveList.find((entry) => ["documents", "shared documents"].includes(name(entry).toLowerCase())) ??
    driveList.find((entry) => name(entry).toLowerCase().includes("document")) ??
    driveList[0];
  const driveId = drive ? id(drive) : "";
  if (!driveId) throw new Error("The SharePoint Documents library was not found");

  const root = await ExcelOnline_Business_Service.ListRootFolder(SITE_URL, driveId);
  if (!root.success) throw root.error ?? new Error("Could not list the SharePoint Documents library");
  let folderItems = records(root.data);
  for (const folderName of FOLDER_PATH) {
    const folder = folderItems.find((entry) => name(entry).toLowerCase() === folderName.toLowerCase());
    const folderId = folder ? id(folder) : "";
    if (!folderId) throw new Error(`The ${folderName} folder was not found`);
    const listing = await ExcelOnline_Business_Service.ListFolder(SITE_URL, driveId, folderId);
    if (!listing.success) throw listing.error ?? new Error(`Could not list the ${folderName} folder`);
    folderItems = records(listing.data);
  }

  const workbook = folderItems.find((entry) => name(entry).toLowerCase() === WORKBOOK_NAME.toLowerCase());
  const workbookId = workbook ? id(workbook) : "";
  if (!workbookId) throw new Error(`${WORKBOOK_NAME} was not found`);

  const tablesResult = await ExcelOnline_Business_Service.GetTables(SITE_URL, driveId, workbookId);
  if (!tablesResult.success) throw tablesResult.error ?? new Error("Could not discover Excel tables");
  const tables = records(tablesResult.data);
  const processParts = new Set<string>();
  const processMachines = new Set<string>();
  const productParts = new Set<string>();
  const allRows: DeviationExcelRow[] = [];

  for (const table of tables) {
    const tableName = name(table);
    if (!tableName) continue;
    const rowsResult = await ExcelOnline_Business_Service.GetItems(
      SITE_URL,
      driveId,
      workbookId,
      tableName,
      undefined,
      undefined,
      1000,
      undefined,
      undefined,
      undefined,
      "ISO 8601",
    );
    if (!rowsResult.success) continue;
    const rows = records(rowsResult.data).map(unwrap);
    const headers = rows.flatMap((row) => Object.keys(row).map(normalizeHeader));
    const hasProcessColumns =
      headers.includes("processdeviationnumber") && headers.includes("part");
    const hasProductColumns =
      headers.includes("productdeviationnumber") && headers.includes("part");
    if (!hasProcessColumns && !hasProductColumns) continue;

    if (hasProcessColumns) {
      for (const row of rows) {
        const deviationNumber = text(rowValue(row, "processdeviationnumber"));
        const part = text(rowValue(row, "part")).toUpperCase().replace(/\s+/g, "");
        const machine = normalizeMachine(rowValue(row, "machine"));
        if (!deviationNumber || (!part && !machine)) continue;
        const complete = text(rowValue(row, "complete")).toLowerCase();
        const status = text(rowValue(row, "status")).toLowerCase();
        const closed = ["yes", "y", "true", "complete", "completed", "closed", "x"].includes(complete) ||
          ["complete", "completed", "closed"].includes(status);
        const dateRequested = parseDateOnly(rowValue(row, "daterequested"));
        allRows.push({ kind: "process", part, machine, dateRequested, closed });
        if (!closed) {
          if (part) processParts.add(part);
          if (machine) processMachines.add(machine);
        }
      }
    }

    if (hasProductColumns) {
      for (const row of rows) {
        const deviationNumber = text(rowValue(row, "productdeviationnumber"));
        const part = text(rowValue(row, "part")).toUpperCase().replace(/\s+/g, "");
        if (!deviationNumber || !part) continue;
        const status = text(rowValue(row, "status")).toLowerCase();
        const closed = ["complete", "completed", "closed"].includes(status);
        const machine = normalizeMachine(rowValue(row, "machine"));
        const dateRequested = parseDateOnly(rowValue(row, "daterequested"));
        allRows.push({ kind: "product", part, machine, dateRequested, closed });
        if (!closed && part) productParts.add(part);
      }
    }
  }

  if (!processParts.size && !processMachines.size && !productParts.size) {
    throw new Error(
      'No active Process Deviation or Product Deviation rows were found in Document Number.xlsm',
    );
  }
  return {
    processParts: [...processParts],
    processMachines: [...processMachines],
    productParts: [...productParts],
    rows: allRows,
  };
}

export function useProcessDeviationParts() {
  return useQuery({
    queryKey: ["process-deviation-parts", WORKBOOK_NAME],
    queryFn: loadActiveProcessDeviations,
    refetchInterval: 60_000,
    refetchOnMount: "always",
  });
}
