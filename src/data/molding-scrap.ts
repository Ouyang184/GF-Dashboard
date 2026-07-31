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
  yield: 82743,
  scrap: 5588,
  scrapRate: 0.063262048431468,
};

export const MOLDING_WEEKLY_SCRAP: WeeklyCellScrap[] = [
  { cell: "LD",  yield: 2740,  scrap: 402,  scrapRate: 0.12794398472310631 },
  { cell: "MD",  yield: 9709,  scrap: 990,  scrapRate: 0.09253201233760165 },
  { cell: "SD1", yield: 38539, scrap: 1712, scrapRate: 0.042533104767583416 },
  { cell: "SD2", yield: 21636, scrap: 2647, scrapRate: 0.10900630070419635 },
  { cell: "FS",  yield: 15593, scrap: 251,  scrapRate: 0.015841959101237063 },
];

export const MOLDING_TOP_PRODUCTS: TopScrapProduct[] = [
  { product: "1/2x1/4 PVC80 Redu Bushing (SPGxT)", yield: 6200, scrap: 964, scrapRate: 0.13456169737576773 },
  { product: '1" PVC80 Plug (MPT)', yield: 5825, scrap: 533, scrapRate: 0.08383139351997483 },
  { product: '2" PVC80 45 Ell (SxS)', yield: 2325, scrap: 472, scrapRate: 0.16875223453700394 },
  { product: "1-1/4x1/2 PVC80 Redu Bushing (SPGxT)", yield: 960, scrap: 398, scrapRate: 0.29307805596465392 },
  { product: '1-1/2" PVC80 90 Ell (SxS)', yield: 2260, scrap: 377, scrapRate: 0.14296549108835799 },
];

export const MOLDING_TOP_PRODUCTS_TOTAL = {
  yield: 44225,
  scrap: 1526,
  scrapRate: 0.0333544621975476,
};

export const MOLDING_TOP_REASONS: TopScrapReason[] = [
  { reason: "Set Up", scrap: 1284, pctOfTotal: 0.31455169034786867 },
  { reason: "Visual", scrap: 765, pctOfTotal: 0.18740813326800587 },
  { reason: "Blush", scrap: 730, pctOfTotal: 0.17883390494855464 },
  { reason: "Robot Dropping Parts", scrap: 711, pctOfTotal: 0.17417932386085253 },
  { reason: "Splay", scrap: 592, pctOfTotal: 0.14502694757471826 },
];

export const MOLDING_TOP_REASONS_TOTAL = {
  scrap: 4082,
  totalScrap: 5588,
};
