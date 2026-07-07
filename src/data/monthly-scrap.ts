// Monthly scrap data sourced from T2_Monthly_Scrap_Sheet2.csv.
// scrapRate = confirmedScrap / (confirmedYield + confirmedScrap) * 100
export type MonthlyScrapPoint = {
  month: string; // "MMM YY"
  year: number;
  monthIndex: number; // 0-11
  confirmedYield: number;
  confirmedScrap: number;
  scrapRate: number; // %
};

const RAW: { year: number; month: number; yieldQty: number; scrap: number }[] = [
  { year: 2025, month: 0, yieldQty: 389382, scrap: 40040 },
  { year: 2025, month: 1, yieldQty: 736240, scrap: 41890 },
  { year: 2025, month: 2, yieldQty: 800687, scrap: 37333 },
  { year: 2025, month: 3, yieldQty: 917778, scrap: 34084 },
  { year: 2025, month: 4, yieldQty: 848271, scrap: 46672 },
  { year: 2025, month: 5, yieldQty: 743563, scrap: 44024 },
  { year: 2025, month: 6, yieldQty: 624612, scrap: 48894 },
  { year: 2025, month: 7, yieldQty: 706874, scrap: 27306 },
  { year: 2025, month: 8, yieldQty: 530841, scrap: 31699 },
  { year: 2026, month: 0, yieldQty: 432338, scrap: 24961 },
  { year: 2026, month: 1, yieldQty: 608200, scrap: 33295 },
  { year: 2026, month: 2, yieldQty: 737101, scrap: 34536 },
  { year: 2026, month: 3, yieldQty: 745999, scrap: 28778 },
  { year: 2026, month: 4, yieldQty: 765557, scrap: 22137 },
  { year: 2026, month: 5, yieldQty: 1072113, scrap: 29834 },
  { year: 2026, month: 6, yieldQty: 127138, scrap: 2643 },
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const MONTHLY_SCRAP: MonthlyScrapPoint[] = RAW.map((r) => {
  const denom = r.yieldQty + r.scrap;
  const rate = denom === 0 ? 0 : (r.scrap / denom) * 100;
  return {
    month: `${MONTH_LABELS[r.month]} ${String(r.year).slice(2)}`,
    year: r.year,
    monthIndex: r.month,
    confirmedYield: r.yieldQty,
    confirmedScrap: r.scrap,
    scrapRate: Math.round(rate * 100) / 100,
  };
});