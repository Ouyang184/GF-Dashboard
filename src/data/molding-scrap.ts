// Data sourced from T2_Scrap.xlsm — "Molding" sheet.
// Update this file when a new weekly workbook is provided.

export type CellTotal = {
  yield: number;
  scrap: number;
  scrapRate: number; // 0..1
};

export type WeeklyCellScrap = {
  cell: string;
  yield: number;
  scrap: number;
  scrapRate: number; // 0..1
};

export type TopScrapProduct = {
  product: string;
  yield: number;
  scrap: number;
  scrapRate: number; // 0..1
};

export type TopScrapReason = {
  reason: string;
  scrap: number;
  pctOfTotal: number; // 0..1
};

export const MOLDING_CELL_TOTAL: CellTotal = {
  yield: 120179,
  scrap: 2647,
  scrapRate: 0.021550811717388825,
};

export const MOLDING_WEEKLY_SCRAP: WeeklyCellScrap[] = [
  { cell: "LD",  yield: 7727,  scrap: 784, scrapRate: 0.09211608506638468 },
  { cell: "MD",  yield: 23772, scrap: 838, scrapRate: 0.03405119869971556 },
  { cell: "SD1", yield: 52392, scrap: 949, scrapRate: 0.017791192516075815 },
  { cell: "SD2", yield: 16898, scrap: 585, scrapRate: 0.03346107647428931 },
  { cell: "FS",  yield: 19390, scrap: 91,  scrapRate: 0.004671218109953288 },
];

export const MOLDING_TOP_PRODUCTS: TopScrapProduct[] = [
  { product: '1-1/2" CPVC80 90 Ell (SxS)',          yield: 12740, scrap: 615, scrapRate: 0.04605016847622613 },
  { product: '4" VIC CPVC 45 ELL (GxG)',            yield: 900,   scrap: 428, scrapRate: 0.32228915662650603 },
  { product: '1" PVC VS FLANGE HUB (S)-MOLD',       yield: 11622, scrap: 291, scrapRate: 0.024427096449257113 },
  { product: '1-1/4" PVC80 45 Ell (SxS)',           yield: 1830,  scrap: 258, scrapRate: 0.1235632183908046 },
  { product: '1/2" CPVC80 Female Adapter (SxFT)',   yield: 0,     scrap: 152, scrapRate: 1 },
];

export const MOLDING_TOP_PRODUCTS_TOTAL = {
  yield: 44225,
  scrap: 1526,
  scrapRate: 0.0333544621975476,
};

export const MOLDING_TOP_REASONS: TopScrapReason[] = [
  { reason: "Splay",        scrap: 870, pctOfTotal: 0.4117368670137246 },
  { reason: "Visual Other", scrap: 345, pctOfTotal: 0.1632749645054425 },
  { reason: "Set up",       scrap: 321, pctOfTotal: 0.1519167061050639 },
  { reason: "NTQ",          scrap: 315, pctOfTotal: 0.14907714150496923 },
  { reason: "Blush",        scrap: 262, pctOfTotal: 0.12399432087079981 },
];

export const MOLDING_TOP_REASONS_TOTAL = {
  scrap: 2113,
  totalScrap: 2647,
};
