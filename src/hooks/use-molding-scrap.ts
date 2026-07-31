import { useQuery } from "@tanstack/react-query";

import type { BlobMetadata, Item } from "@/generated/models/ExcelOnline_Business_Model";
import { ExcelOnline_Business_Service } from "@/generated/services/ExcelOnline_Business_Service";
import {
  MOLDING_CELL_TOTAL,
  MOLDING_TOP_PRODUCTS,
  MOLDING_TOP_PRODUCTS_TOTAL,
  MOLDING_TOP_REASONS,
  MOLDING_TOP_REASONS_TOTAL,
  MOLDING_WEEKLY_SCRAP,
  type CellTotal,
  type TopScrapProduct,
  type TopScrapReason,
  type WeeklyCellScrap,
} from "@/data/molding-scrap";

export type MoldingScrapData = {
  sheetName: string;
  cellTotal: CellTotal;
  weeklyScrap: WeeklyCellScrap[];
  topProducts: TopScrapProduct[];
  topProductsTotal: CellTotal;
  topReasons: TopScrapReason[];
  topReasonsTotal: { scrap: number; totalScrap: number };
};

type QualityTableRow = {
  MetricType?: unknown;
  Label?: unknown;
  YieldValue?: unknown;
  ScrapValue?: unknown;
  RateValue?: unknown;
  TotalScrapValue?: unknown;
  SortOrder?: unknown;
};

const SITE_URL = "https://georgfischer.sharepoint.com/sites/GFPS-AMGManufacturingEngineering";
const FOLDER_PATH = ["Documentation", "T2"] as const;
const WORKBOOK_NAME = "T2 Scrap.xlsm";
const TABLE_NAME = "PowerAppsQuality";
const REFRESH_MS = 5 * 60_000;
const LOCATION_CACHE_KEY = "quality:excel-location:v1";
const DATA_CACHE_KEY = "quality:live-data:v1";

const VERIFIED_SNAPSHOT: MoldingScrapData = {
  sheetName: "Molding",
  cellTotal: MOLDING_CELL_TOTAL,
  weeklyScrap: MOLDING_WEEKLY_SCRAP,
  topProducts: MOLDING_TOP_PRODUCTS,
  topProductsTotal: MOLDING_TOP_PRODUCTS_TOTAL,
  topReasons: MOLDING_TOP_REASONS,
  topReasonsTotal: MOLDING_TOP_REASONS_TOTAL,
};

type ExcelLocation = { driveId: string; workbookId: string };

function apiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
}

function records(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  for (const key of ["value", "Value", "items", "Items"]) {
    if (Array.isArray(object[key])) return records(object[key]);
  }
  return [];
}

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function removeStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

function initialQualityData(): MoldingScrapData {
  const cached = readStorage<MoldingScrapData>(DATA_CACHE_KEY);
  return cached?.weeklyScrap?.length ? cached : VERIFIED_SNAPSHOT;
}

function numeric(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = text(value);
  if (!raw) return 0;
  const isPercent = raw.endsWith("%");
  const parsed = Number(raw.replace(/[%,$\s]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return isPercent ? parsed / 100 : parsed;
}

function identifier(item: Record<string, unknown>): string {
  for (const key of ["Id", "id", "Value", "value", "Name", "name"]) {
    const candidate = text(item[key]);
    if (candidate) return candidate;
  }
  return "";
}

function displayName(item: Record<string, unknown>): string {
  for (const key of ["DisplayName", "displayName", "Name", "name", "Path", "path"]) {
    const candidate = text(item[key]);
    if (candidate) return candidate;
  }
  return "";
}

function requireSuccess<T>(result: { success: boolean; data: T; error?: unknown }, label: string): T {
  if (!result.success) {
    if (result.error instanceof Error) throw result.error;
    const message = result.error && typeof result.error === "object" && "message" in result.error
      ? text((result.error as { message?: unknown }).message)
      : "";
    throw new Error(message || `${label} failed`);
  }
  return result.data;
}

function findBlob(items: BlobMetadata[], name: string, folder: boolean): BlobMetadata {
  const target = name.toLowerCase();
  const match = items.find((item) => Boolean(item.IsFolder) === folder && text(item.Name || item.DisplayName).toLowerCase() === target);
  if (!match) throw new Error(`${name} was not found in the Quality SharePoint library`);
  return match;
}

function unwrapExcelRow(item: Item): QualityTableRow {
  const record = item as Record<string, unknown>;
  const dynamic = record.dynamicProperties;
  return (dynamic && typeof dynamic === "object" ? dynamic : record) as QualityTableRow;
}

function buildQualityData(rows: QualityTableRow[]): MoldingScrapData {
  const sorted = (type: string) => rows
    .filter((row) => text(row.MetricType) === type)
    .sort((a, b) => numeric(a.SortOrder) - numeric(b.SortOrder));
  const cell = sorted("CellTotal")[0];
  const productTotal = sorted("ProductTotal")[0];
  const reasonTotal = sorted("ReasonTotal")[0];
  if (!cell || !productTotal || !reasonTotal) throw new Error("PowerAppsQuality is missing required summary rows");

  return {
    sheetName: "Molding",
    cellTotal: { yield: numeric(cell.YieldValue), scrap: numeric(cell.ScrapValue), scrapRate: numeric(cell.RateValue) },
    weeklyScrap: sorted("WeeklyCell").map((row) => ({
      cell: text(row.Label), yield: numeric(row.YieldValue), scrap: numeric(row.ScrapValue), scrapRate: numeric(row.RateValue),
    })).filter((row) => row.cell),
    topProducts: sorted("TopProduct").map((row) => ({
      product: text(row.Label), yield: numeric(row.YieldValue), scrap: numeric(row.ScrapValue), scrapRate: numeric(row.RateValue),
    })).filter((row) => row.product),
    topProductsTotal: {
      yield: numeric(productTotal.YieldValue), scrap: numeric(productTotal.ScrapValue), scrapRate: numeric(productTotal.RateValue),
    },
    topReasons: sorted("TopReason").map((row) => ({
      reason: text(row.Label), scrap: numeric(row.ScrapValue), pctOfTotal: numeric(row.RateValue),
    })).filter((row) => row.reason),
    topReasonsTotal: { scrap: numeric(reasonTotal.ScrapValue), totalScrap: numeric(reasonTotal.TotalScrapValue) },
  };
}

async function discoverExcelLocation(): Promise<ExcelLocation> {
  const drivesResult = await ExcelOnline_Business_Service.GetDrives(SITE_URL);
  const drives = records(requireSuccess(drivesResult, "Excel library discovery"));
  const drive = drives.find((item) => ["documents", "shared documents", "documentation"].includes(displayName(item).toLowerCase()))
    ?? drives.find((item) => displayName(item).toLowerCase().includes("document"))
    ?? drives[0];
  if (!drive) throw new Error("No document library was returned for the Quality SharePoint site");
  const driveId = identifier(drive);
  if (!driveId) throw new Error("The Quality document library did not return an identifier");

  const rootResult = await ExcelOnline_Business_Service.ListRootFolder(SITE_URL, driveId);
  let folderItems = requireSuccess(rootResult, "Quality library listing");
  let folderId = "";
  for (const folderName of FOLDER_PATH) {
    const folder = findBlob(folderItems, folderName, true);
    folderId = text(folder.Id);
    if (!folderId) throw new Error(`The ${folderName} folder did not return an identifier`);
    const folderResult = await ExcelOnline_Business_Service.ListFolder(SITE_URL, driveId, folderId);
    folderItems = requireSuccess(folderResult, `${folderName} folder listing`);
  }

  const workbook = findBlob(folderItems, WORKBOOK_NAME, false);
  if (!workbook.Id) throw new Error("The Quality workbook did not return an identifier");

  return { driveId, workbookId: workbook.Id };
}

async function readExcelQuality({ driveId, workbookId }: ExcelLocation): Promise<MoldingScrapData> {
  const itemsResult = await ExcelOnline_Business_Service.GetItems(
    SITE_URL, driveId, workbookId, TABLE_NAME, undefined, "SortOrder asc", 100,
    undefined, undefined, undefined, "ISO 8601",
  );
  const items = requireSuccess(itemsResult, "PowerAppsQuality table read").value ?? [];
  return buildQualityData(items.map(unwrapExcelRow));
}

async function loadExcelQuality(): Promise<MoldingScrapData> {
  const cachedLocation = readStorage<ExcelLocation>(LOCATION_CACHE_KEY);
  if (cachedLocation?.driveId && cachedLocation.workbookId) {
    try {
      return await readExcelQuality(cachedLocation);
    } catch {
      removeStorage(LOCATION_CACHE_KEY);
    }
  }

  const location = await discoverExcelLocation();
  writeStorage(LOCATION_CACHE_KEY, location);
  return readExcelQuality(location);
}

async function loadLocalQuality(signal: AbortSignal): Promise<MoldingScrapData> {
  const response = await fetch(`${apiBaseUrl()}/api/t2-scrap?sheet=Molding`, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Local Excel API ${response.status}`);
  const payload = await response.json();
  return (payload.molding ?? payload) as MoldingScrapData;
}

async function loadQuality(signal: AbortSignal): Promise<MoldingScrapData> {
  try {
    return await loadExcelQuality();
  } catch (excelError) {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!isLocal) throw excelError;
    return loadLocalQuality(signal);
  }
}

export function useMoldingScrap() {
  const query = useQuery({
    queryKey: ["molding-scrap-live-excel"],
    queryFn: async ({ signal }) => {
      const data = await loadQuality(signal);
      writeStorage(DATA_CACHE_KEY, data);
      return data;
    },
    initialData: initialQualityData,
    initialDataUpdatedAt: 0,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  return { data: query.data ?? null, isLoading: query.isPending, error: query.error?.message ?? null };
}
