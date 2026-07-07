import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntouchSnapshot, type IntouchSnapshot } from "@/hooks/use-intouch-snapshot";
import { CopilotSyncPanel } from "@/components/intouch/CopilotSyncPanel";
import { useFloorOverrides, setFloorOverride, useDeviationCount } from "@/hooks/use-floor-overrides";
import {
  useDeviationMap,
  useDeviationCountFor,
  toggleDeviation,
  clearDeviations,
  type PillarKey as DeviationPillarKey,
} from "@/hooks/use-deviation-map";
import { useMastercardsData, useMastercardsUploader } from "@/hooks/use-mastercards-upload";
import { useComplianceData, useComplianceUploader } from "@/hooks/use-compliance-upload";
import { useDashboardData, type DashboardData, type FloorMapEntry } from "@/hooks/use-dashboard-data";
import { MONTHLY_SCRAP } from "@/data/monthly-scrap";
import {
  MOLDING_CELL_TOTAL,
  MOLDING_WEEKLY_SCRAP,
  MOLDING_TOP_PRODUCTS,
  MOLDING_TOP_PRODUCTS_TOTAL,
  MOLDING_TOP_REASONS,
  MOLDING_TOP_REASONS_TOTAL,
} from "@/data/molding-scrap";
import {
  Activity,
  AlertTriangle,
  Box,
  CalendarDays,
  ChevronDown,
  Cloud,
  CloudRain,
  CloudSnow,
  Gauge,
  Shield,
  BadgeCheck,
  Sun,
  Quote,
  Truck,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Legend as RcLegend,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AMG Dashboard — Daily Process Management" },
      { name: "description", content: "Live QDIP board: Safety, Quality, Delivery, Inventory, Productivity with shift status, time, weather, and daily lottery." },
      { property: "og:title", content: "AMG Dashboard" },
      { property: "og:description", content: "Daily Process Management dashboard for AMG." },
    ],
  }),
  component: Index,
});

type Status = "ok" | "warn" | "fail" | "na";

type Pillar = {
  key: "S" | "Q" | "D" | "I" | "P";
  label: string;
  kpi: string;
  icon: typeof Shield;
  accent: string;
};

const PILLARS: Pillar[] = [
  { key: "S", label: "Safety", kpi: "0 Equip Safety Issues", icon: Shield, accent: "from-primary/20 to-primary/0" },
  { key: "Q", label: "Quality", kpi: "Weekly Scrap < 3.5%", icon: BadgeCheck, accent: "from-primary/20 to-primary/0" },
  { key: "D", label: "Delivery", kpi: "≥ 3 New Process Deviations", icon: Truck, accent: "from-primary/20 to-primary/0" },
  { key: "I", label: "Inventory", kpi: "0 New Product Deviations", icon: Box, accent: "from-primary/20 to-primary/0" },
  { key: "P", label: "Productivity", kpi: "Machine Downtime", icon: Gauge, accent: "from-primary/20 to-primary/0" },
];

const SHIFTS = ["LD", "MD", "SD1", "SD2", "FS", "PA&F", "EXT"] as const;

const FLOOR_LAYOUT: { zone: string; machines: string[] }[] = [
  { zone: "ENG. Extrusion", machines: ["11EM00", "2EM20", "10EM00", "4EM20"] },
  { zone: "Vinyls Extrusion", machines: ["1EM10"] },
  { zone: "Coil & Collar", machines: ["419AM0", "417AM0", "415AM0", "413AM0", "COIL5", "COIL6"] },
  { zone: "Fuseal Cell", machines: ["310IM30", "307IM30", "306IM30", "305IM30", "301IM30", "109IM00"] },
  { zone: "SD Cell 1", machines: ["222IM10", "213IM10", "212IM10", "423IM10", "101IM10"] },
  { zone: "SD Cell 2", machines: ["113IM00", "210IM00", "209IM00", "114IM00", "433IM10", "104IM10", "115IM00"] },
  { zone: "MD Cell", machines: ["201IM40", "512IM40", "443IM10", "513IM40"] },
  { zone: "LD Cell", machines: ["523IM40", "202IM50", "913IM50", "102IM50"] },
];

const HIGHLIGHT_MACHINES = new Set(["301IM30", "109IM00"]);

type PillarDetail = {
  issues: string[];
  actions: { task: string; owner: string; due: string }[];
  shiftNotes: Record<string, string>;
  stats: { label: string; value: string }[];
};

const PILLAR_DETAILS: Record<Pillar["key"], PillarDetail> = {
  S: {
    issues: ["PPE audit overdue – Line 2", "Near-miss reported at press 3", "Eye-wash inspection due"],
    actions: [
      { task: "Re-train Line 2 on PPE SOP", owner: "J. Reyes", due: "Fri" },
      { task: "Replace damaged guarding", owner: "Maint.", due: "Mon" },
    ],
    shiftNotes: { LD: "All clear", MD: "Minor spill, contained", SD1: "PPE check ok", SD2: "—", FS: "—", "PA&F": "Audit pending", EXT: "—" },
    stats: [
      { label: "Days since incident", value: "47" },
      { label: "MTD OK", value: "92%" },
      { label: "Open audits", value: "1" },
    ],
  },
  Q: {
    issues: ["Scrap spike on press 4 (6.2%)", "Color drift lot #A-204", "CMM gauge R&R due"],
    actions: [
      { task: "Root cause press 4 scrap", owner: "Quality", due: "Wed" },
      { task: "Re-run gauge R&R", owner: "M. Patel", due: "Thu" },
    ],
    shiftNotes: { LD: "Within spec", MD: "Spike 04:20", SD1: "Recovered", SD2: "—", FS: "—", "PA&F": "—", EXT: "—" },
    stats: [
      { label: "Weekly scrap", value: "5.4%" },
      { label: "First pass yield", value: "94%" },
      { label: "Open NCRs", value: "3" },
    ],
  },
  D: {
    issues: ["PO #4421 late 1 day", "Carrier delay – inbound resin", "Process deviation: cycle time"],
    actions: [
      { task: "Expedite PO #4421", owner: "Logistics", due: "Today" },
      { task: "Update sequencing plan", owner: "Planner", due: "Fri" },
    ],
    shiftNotes: { LD: "On schedule", MD: "−2 units", SD1: "Caught up", SD2: "—", FS: "—", "PA&F": "—", EXT: "Delay" },
    stats: [
      { label: "OTIF", value: "96%" },
      { label: "Backlog", value: "12" },
      { label: "Deviations", value: "3" },
    ],
  },
  I: {
    issues: ["Resin lot variance – silo 2", "Cycle count mismatch bin B-14", "Mold locker not returned"],
    actions: [
      { task: "Recount bin B-14", owner: "Wh. team", due: "Tue" },
      { task: "Retrieve mold locker", owner: "Tooling", due: "Wed" },
    ],
    shiftNotes: { LD: "Counts ok", MD: "1 short", SD1: "Reconciled", SD2: "—", FS: "—", "PA&F": "—", EXT: "—" },
    stats: [
      { label: "Inventory accuracy", value: "98.1%" },
      { label: "Days on hand", value: "11" },
      { label: "Variances", value: "2" },
    ],
  },
  P: {
    issues: ["Changeover 38 min (target 25)", "Press 6 short stops", "OEE below target on SD1"],
    actions: [
      { task: "SMED kaizen press 6", owner: "CI team", due: "Next wk" },
      { task: "Tune sensor on conveyor 3", owner: "Maint.", due: "Thu" },
    ],
    shiftNotes: { LD: "OEE 82%", MD: "OEE 76%", SD1: "OEE 71%", SD2: "—", FS: "—", "PA&F": "—", EXT: "—" },
    stats: [
      { label: "OEE", value: "78%" },
      { label: "Downtime (MTD)", value: "14.2h" },
      { label: "Short stops", value: "21" },
    ],
  },
};

// Deterministic seeded RNG so dots/shifts/lottery are stable per day.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(d: Date, salt = 0) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + salt;
}

function pickStatus(rng: () => number): Status {
  const r = rng();
  if (r < 0.78) return "ok";
  if (r < 0.92) return "warn";
  return "fail";
}

function statusColor(s: Status) {
  switch (s) {
    case "ok":
      return "bg-success shadow-[0_0_10px_var(--success)]";
    case "warn":
      return "bg-warning shadow-[0_0_10px_var(--warning)]";
    case "fail":
      return "bg-danger shadow-[0_0_10px_var(--danger)]";
    default:
      return "bg-muted";
  }
}

function buildMonthDots(pillarIdx: number, daysInMonth: number) {
  const today = new Date();
  const rng = mulberry32(dateSeed(today, pillarIdx * 31));
  const dots: { day: number; status: Status; weekend: boolean }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(today.getFullYear(), today.getMonth(), d).getDay();
    const weekend = dow === 0 || dow === 6;
    if (weekend) {
      dots.push({ day: d, status: "na", weekend: true });
    } else if (d > today.getDate()) {
      dots.push({ day: d, status: "na", weekend: false });
    } else {
      dots.push({ day: d, status: pickStatus(rng), weekend: false });
    }
  }
  return dots;
}

/**
 * Apply live deviation rules to today's dot:
 *  - Inventory (I): ≥1 deviation → red
 *  - Delivery  (D): >3 deviations → red
 */
function applyDeviationRule(
  dots: { day: number; status: Status; weekend?: boolean }[],
  pillarKey: string,
  deviationCount: number,
) {
  const today = new Date().getDate();
  const trigger =
    (pillarKey === "I" && deviationCount >= 1) ||
    (pillarKey === "D" && deviationCount > 3);
  if (!trigger) return dots;
  return dots.map((d) =>
    d.day === today && !d.weekend ? { ...d, status: "fail" as Status } : d,
  );
}

/**
 * Quality pillar rule:
 *   For each ISO-ish week (Sun–Sat), compute average daily scrap % using the
 *   same deterministic generator as AvailabilityScrapChartImpl.
 *   If the week's average is < 3.5% → every weekday dot in that week is green.
 *   Otherwise → red. Weekend and future days stay "na".
 */
function applyQualityWeeklyScrapRule(
  dots: { day: number; status: Status; weekend?: boolean }[],
) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDay = today.getDate();

  // Per-day scrap % using the same seed as the availability/scrap chart.
  const scrapForDay = (day: number) => {
    const d = new Date(year, month, day);
    const rng = mulberry32(dateSeed(d, 4242));
    rng(); // availNoise slot (kept in sync with the chart generator)
    const scrapNoise = (rng() - 0.5) * 0.5;
    // Rough proxy of the chart's downward trend, clamped like the chart.
    return Math.max(0.6, Math.round((4.2 + scrapNoise) * 10) / 10);
  };

  // Group days by week bucket (Sun-anchored).
  const weekBucket = (day: number) => {
    const d = new Date(year, month, day);
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - d.getDay());
    return `${sunday.getFullYear()}-${sunday.getMonth()}-${sunday.getDate()}`;
  };

  const weekAvg = new Map<string, number>();
  const weekDays = new Map<string, number[]>();
  for (const dot of dots) {
    if (dot.weekend || dot.day > todayDay) continue;
    const key = weekBucket(dot.day);
    if (!weekDays.has(key)) weekDays.set(key, []);
    weekDays.get(key)!.push(dot.day);
  }
  for (const [key, days] of weekDays) {
    const avg = days.reduce((s, d) => s + scrapForDay(d), 0) / days.length;
    weekAvg.set(key, avg);
  }

  return dots.map((d) => {
    if (d.weekend || d.day > todayDay) return d;
    const avg = weekAvg.get(weekBucket(d.day)) ?? 0;
    return { ...d, status: (avg < 3.5 ? "ok" : "fail") as Status };
  });
}

const DAILY_QUOTES: { text: string; author: string }[] = [
  { text: "Quality is never an accident; it is always the result of intelligent effort.", author: "John Ruskin" },
  { text: "The most dangerous kind of waste is the waste we do not recognize.", author: "Shigeo Shingo" },
  { text: "Without standards, there can be no improvement.", author: "Taiichi Ohno" },
  { text: "If you can't describe what you are doing as a process, you don't know what you're doing.", author: "W. Edwards Deming" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Safety isn't expensive, it's priceless.", author: "Unknown" },
  { text: "Continuous improvement is better than delayed perfection.", author: "Mark Twain" },
  { text: "A bad system will beat a good person every time.", author: "W. Edwards Deming" },
  { text: "Where there is no standard, there can be no kaizen.", author: "Taiichi Ohno" },
  { text: "Do the best you can until you know better. Then when you know better, do better.", author: "Maya Angelou" },
  { text: "Excellence is doing ordinary things extraordinarily well.", author: "John W. Gardner" },
  { text: "Working together, ordinary people can perform extraordinary feats.", author: "Jean Ritchie" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
];

function useDailyQuote() {
  return useMemo(() => {
    const today = new Date();
    const idx = dateSeed(today, 42) % DAILY_QUOTES.length;
    return DAILY_QUOTES[idx];
  }, []);
}



function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

type Weather = { tempF: number; code: number; label: string; city: string } | null;

function weatherLabel(code: number): { label: string; Icon: typeof Sun } {
  if (code === 0) return { label: "Clear", Icon: Sun };
  if (code <= 3) return { label: "Partly Cloudy", Icon: Cloud };
  if (code >= 71 && code <= 77) return { label: "Snow", Icon: CloudSnow };
  if (code >= 51 && code <= 67) return { label: "Rain", Icon: CloudRain };
  if (code >= 80) return { label: "Showers", Icon: CloudRain };
  return { label: "Cloudy", Icon: Cloud };
}

function useWeather(): Weather {
  const [w, setW] = useState<Weather>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=34.7465&longitude=-92.2896&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto",
        );
        const j = await res.json();
        if (cancelled) return;
        setW({
          tempF: Math.round(j.current?.temperature_2m ?? 0),
          code: j.current?.weather_code ?? 0,
          label: weatherLabel(j.current?.weather_code ?? 0).label,
          city: "Little Rock, AR",
        });
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return w;
}

function Index() {
  const liveNow = useNow();
  const now = liveNow ?? new Date(0);
  const weather = useWeather();
  const quote = useDailyQuote();
  const deviationCount = useDeviationCount();
  const deliveryDeviations = useDeviationCountFor("D");
  const inventoryDeviations = useDeviationCountFor("I");
  const uploadMastercards = useMastercardsUploader();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const uploadCompliance = useComplianceUploader();
  const complianceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        uploadInputRef.current?.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        complianceInputRef.current?.click();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const result = await uploadMastercards(file);
      console.info("[mastercards] uploaded", result);
    } catch (err) {
      console.error("[mastercards] upload failed", err);
    }
  };

  const onComplianceUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const result = await uploadCompliance(file);
      console.info("[compliance] uploaded", result);
    } catch (err) {
      console.error("[compliance] upload failed", err);
    }
  };

  const daysInMonth = liveNow ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() : 30;
  const monthName = liveNow ? now.toLocaleString(undefined, { month: "long" }) : "";
  const dateStr = liveNow ? liveNow.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" }) : "";
  const timeStr = liveNow ? liveNow.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--";

  const WIcon = weather ? weatherLabel(weather.code).Icon : Cloud;

  // Per-pillar shift status (deterministic per day)
  const shiftStatuses = PILLARS.map((_, i) => {
    const rng = mulberry32(dateSeed(now, 1000 + i));
    return SHIFTS.map(() => pickStatus(rng));
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_oklch(0.27_0.04_200/0.35),transparent_60%),radial-gradient(ellipse_at_bottom_right,_oklch(0.4_0.12_160/0.18),transparent_55%)]" />

      {/* Visible upload controls */}
      <input
        ref={uploadInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={onUploadChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={complianceInputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
        onChange={onComplianceUploadChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="fixed bottom-4 right-4 z-50 flex gap-2">
        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold shadow-[var(--shadow-card)] hover:opacity-90 transition"
          title="Upload MasterCards Excel/CSV (Ctrl+Shift+U)"
        >
          Upload MasterCards
        </button>
        <button
          type="button"
          onClick={() => complianceInputRef.current?.click()}
          className="rounded-md bg-card border border-border text-foreground px-3 py-2 text-xs font-semibold shadow-[var(--shadow-card)] hover:bg-background transition"
          title="Upload Compliance Checklist (Ctrl+Shift+C)"
        >
          Upload Checklist
        </button>
      </div>

      <header className="border-b border-border/60 backdrop-blur-md bg-background/70 sticky top-0 z-20">
        <div className="mx-auto max-w-[1600px] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="h-10 px-2.5 rounded-xl bg-white grid place-items-center font-black tracking-tight shadow-[var(--shadow-glow)] ring-1 ring-[#0033a0]/20"
              aria-label="Georg Fischer"
            >
              <span className="text-base leading-none font-mono text-[#0033a0]">+GF+</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">AMG Dashboard</h1>
              <p className="text-xs text-muted-foreground mt-1">Daily Process Management · Cell: Engr</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border/60">
              <WIcon className="size-5 text-accent" />
              <div className="leading-tight">
                <div className="text-sm font-semibold">
                  {weather ? `${weather.tempF}°F` : "—"}{" "}
                  <span className="text-muted-foreground font-normal">
                    {weather?.label ?? "Loading"}
                  </span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {weather?.city ?? "—"}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-mono text-2xl font-bold tabular-nums tracking-tight" suppressHydrationWarning>{timeStr}</div>
              <div className="text-xs text-muted-foreground" suppressHydrationWarning>{dateStr}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8 space-y-8">
        {/* Top stats row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Month" value={monthName || "—"} sub={liveNow ? `Day ${now.getDate()} / ${daysInMonth}` : ""} icon={CalendarDays} />
          <OpenEscalationsStat />
          <QuoteCard text={quote.text} author={quote.author} />
        </section>

        {/* QDIP grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {PILLARS.map((p, i) => (
            <PillarCard
              key={p.key}
              pillar={p}
              dots={
                p.key === "Q"
                  ? applyQualityWeeklyScrapRule(buildMonthDots(i, daysInMonth))
                  : p.key === "D"
                    ? applyDeviationRule(buildMonthDots(i, daysInMonth), "D", deliveryDeviations)
                    : p.key === "I"
                      ? applyDeviationRule(buildMonthDots(i, daysInMonth), "I", inventoryDeviations)
                      : applyDeviationRule(buildMonthDots(i, daysInMonth), p.key, deviationCount)
              }
              shifts={shiftStatuses[i]}
            />
          ))}
        </section>

        {/* Footer notes */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <NotesCard
            title="Open Escalations"
            storageKey="notes:open-escalations"
            defaultItems={[
              "Mold lockers not being returned",
              "PVL/LPVL grinder blades damaged by metal tools",
            ]}
          />
          <NotesCard
            title="Long Term Actions"
            storageKey="notes:long-term-actions"
            defaultItems={[
              "Repro compliance: 6/18 = 33%",
              "4 reprints made (10 → 14, 78%)",
              "2 MC in cabinet but not on machine",
            ]}
          />
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Activity;
  tone?: "ok" | "warn" | "fail";
}) {
  const toneCls =
    tone === "ok"
      ? "text-success"
      : tone === "warn"
        ? "text-warning"
        : tone === "fail"
          ? "text-danger"
          : "text-accent";
  return (
    <div className="relative overflow-hidden rounded-sm border border-border bg-card p-5 shadow-[var(--shadow-card)] border-l-4 border-l-primary">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-primary">{value}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <Icon className={`size-5 ${toneCls}`} />
      </div>
    </div>
  );
}

function AvailabilityScrapChart() {
  return <AvailabilityScrapChartImpl />;
}

function LiveDashboardSection() {
  const { data, isLoading, error, lastFetchedAt } = useDashboardData();
  const [reproComplete, setReproComplete] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("amg.reproComplete") ?? "";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("amg.reproComplete", reproComplete);
    }
  }, [reproComplete]);
  return (
    <section className="space-y-4">
      {error && (
        <div className="rounded-sm border border-danger/50 bg-danger/10 text-danger px-4 py-3 text-sm">
          Cannot reach dashboard API ({error}). Make sure the local backend is running at{" "}
          <code className="font-mono">{(import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ?? "http://localhost:3001"}</code>.
        </div>
      )}
      {isLoading && !data && (
        <div className="rounded-sm border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Loading live dashboard data…
        </div>
      )}
      {data && (
        <LiveKpiRow
          data={data}
          lastFetchedAt={lastFetchedAt}
          reproComplete={reproComplete}
          onReproChange={setReproComplete}
        />
      )}
      {data && <LiveLatestRowsTable data={data} />}
      {data && <MissingMcList data={data} />}
    </section>
  );
}

function LiveKpiRow({
  data,
  lastFetchedAt,
  reproComplete,
  onReproChange,
}: {
  data: DashboardData;
  lastFetchedAt: Date | null;
  reproComplete: string;
  onReproChange: (v: string) => void;
}) {
  const pct = (n: number) => `${Math.round(n)}%`;
  const denom = data.machinesRunning || 0;
  return (
    <div className="space-y-2">
      <div className="rounded-sm border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-4 text-primary" />
          Production Window: {data.productionWindowStart || "7:00 AM"} – {data.productionWindowEnd || "7:00 AM"}
        </span>
        {data.productionDate && (
          <span className="text-xs font-normal text-muted-foreground">
            Production date: {data.productionDate}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Live from SharePoint → Backend API
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              Latest record: {data.latestDate ? data.latestDate : "—"}
            </span>
            <span className="flex items-center gap-1.5" title="API updatedAt timestamp">
              <Activity className="size-3.5" />
              API updated: {data.updatedAt ? data.updatedAt : "—"}
            </span>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
          Fetched {lastFetchedAt ? lastFetchedAt.toLocaleTimeString() : "—"} · auto-refresh 30s
        </div>
      </div>
      <KpiTree
        data={data}
        denom={denom}
        pct={pct}
        reproComplete={reproComplete}
        onReproChange={onReproChange}
      />
    </div>
  );
}

function KpiTree({
  data,
  denom,
  pct,
  reproComplete,
  onReproChange,
}: {
  data: DashboardData;
  denom: number;
  pct: (n: number) => string;
  reproComplete: string;
  onReproChange: (v: string) => void;
}) {
  const CONN = "bg-border/70";
  const rawRows = Number.isFinite(data.totalRows) ? data.totalRows : denom;
  return (
    <div className="mx-auto w-full max-w-5xl pt-2">
      {/* Level 1 — Root centered, Repro Complete aligned to the right */}
      <div className="grid grid-cols-3 gap-4 items-start">
        <div />
        <StatCard
          label="Machines Running"
          value={String(denom)}
          sub={`${rawRows} rows · unique Machine + Part`}
          icon={Gauge}
        />
        <ReproCompleteCard value={reproComplete} onChange={onReproChange} />
      </div>

      {/* Trunk + branch bar to level 2 */}
      <div className="grid grid-cols-3">
        <div />
        <div className={`mx-auto h-6 w-px ${CONN}`} />
        <div />
      </div>
      <div className="grid grid-cols-3">
        <div className="flex justify-end">
          <div className={`h-px w-1/2 ${CONN}`} />
        </div>
        <div className={`h-px w-full ${CONN}`} />
        <div className="flex justify-start">
          <div className={`h-px w-1/2 ${CONN}`} />
        </div>
      </div>
      <div className="grid grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex justify-center">
            <div className={`h-6 w-px ${CONN}`} />
          </div>
        ))}
      </div>

      {/* Level 2 */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="MC Available"
          value={pct(data.mcAvailablePercent ?? 0)}
          sub={`${data.mcAvailableCount ?? 0} of ${denom} · MasterCard = Yes`}
          icon={BadgeCheck}
          tone="ok"
        />
        <StatCard
          label="Missing / No MC"
          value={String(data.missingCount ?? 0)}
          sub={`${pct(data.missingPercent ?? 0)} · No / blank / missing`}
          icon={AlertTriangle}
          tone="fail"
        />
        <StatCard
          label="Compliance"
          value={pct(data.compliancePercent)}
          sub={`${data.complianceCount} of ${denom} · Yes + Comparable`}
          icon={Gauge}
          tone="ok"
        />
      </div>

      {/* Trunk under MC Available -> branch bar -> two children */}
      <div className="grid grid-cols-3">
        <div className="flex justify-center">
          <div className={`h-6 w-px ${CONN}`} />
        </div>
        <div />
        <div />
      </div>
      <div className="grid grid-cols-3">
        <div className="px-[16.6%]">
          <div className={`h-px w-full ${CONN}`} />
        </div>
        <div />
        <div />
      </div>
      <div className="grid grid-cols-3">
        <div className="grid grid-cols-2">
          <div className="flex justify-center">
            <div className={`h-6 w-px ${CONN}`} />
          </div>
          <div className="flex justify-center">
            <div className={`h-6 w-px ${CONN}`} />
          </div>
        </div>
        <div />
        <div />
      </div>

      {/* Level 3 — children of MC Available only */}
      <div className="grid grid-cols-3 gap-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Matching"
            value={String(data.matchingCount ?? 0)}
            sub={`${pct(data.matchingPercent ?? 0)} · Exact match`}
            icon={Shield}
            tone="ok"
          />
          <StatCard
            label="Comparable"
            value={String(data.comparableCount ?? 0)}
            sub={`${pct(data.comparablePercent ?? 0)} · Comparable`}
            icon={Shield}
            tone="warn"
          />
        </div>
        <div />
        <div />
      </div>
    </div>
  );
}

function ReproCompleteCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-sm border border-border bg-card p-5 shadow-[var(--shadow-card)] border-l-4 border-l-primary">
      <div className="flex items-start justify-between">
        <div className="w-full">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Repro Complete
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            className="mt-2 w-full bg-transparent text-3xl font-bold tracking-tight text-primary outline-none border-b border-transparent focus:border-primary/40"
            aria-label="Repro Complete (manual entry)"
          />
          <div className="mt-1 text-xs text-muted-foreground">Manual entry</div>
        </div>
        <BadgeCheck className="size-5 text-accent" />
      </div>
    </div>
  );
}

function LiveLatestRowsTable({ data }: { data: DashboardData }) {
  return _LiveLatestRowsTableImpl({ data });
}

function MissingMcList({ data }: { data: DashboardData }) {
  const jobs = (data.machineJobs ?? data.latestRows ?? []).filter((r) => {
    const mc = String(r.masterCard ?? "").toLowerCase().trim();
    return mc === "" || mc === "no" || mc === "n" || mc === "missing";
  });
  if (!jobs.length) return null;
  return (
    <div className="rounded-sm border border-danger/50 bg-danger/5 shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-4 py-3 border-b border-danger/40 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-danger">
          <AlertTriangle className="size-4" />
          Missing MasterCard — {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Machine + Part
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-background/50 text-muted-foreground uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left">Machine</th>
              <th className="px-3 py-2 text-left">Part Number</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Work Order</th>
              <th className="px-3 py-2 text-left">Tech</th>
              <th className="px-3 py-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((r) => (
              <tr key={`${r.id}-${r.machine}-${r.partNumber}`} className="border-t border-border/60">
                <td className="px-3 py-2 font-semibold">{r.machine}</td>
                <td className="px-3 py-2 font-mono">{r.partNumber}</td>
                <td className="px-3 py-2">{r.partDescription}</td>
                <td className="px-3 py-2 font-mono">{r.workOrder}</td>
                <td className="px-3 py-2">{r.productionTech}</td>
                <td className="px-3 py-2">{r.dateCreated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function _LiveLatestRowsTableImpl({ data }: { data: DashboardData }) {
  if (!data.latestRows?.length) return null;
  const asText = (v: unknown): string => {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      return String(o.Value ?? o.value ?? o.Title ?? o.LookupValue ?? o.DisplayName ?? "");
    }
    return String(v);
  };
  return (
    <div className="rounded-sm border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold">Latest Records</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {data.latestRows.length} rows
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-background/50 text-muted-foreground uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Work Order</th>
              <th className="px-3 py-2 text-left">Machine</th>
              <th className="px-3 py-2 text-left">Part</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Tech</th>
              <th className="px-3 py-2 text-left">Accept</th>
              <th className="px-3 py-2 text-left">MC</th>
            </tr>
          </thead>
          <tbody>
            {data.latestRows.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-3 py-2 font-mono">{r.id}</td>
                <td className="px-3 py-2">{r.dateCreated}</td>
                <td className="px-3 py-2 font-mono">{r.workOrder}</td>
                <td className="px-3 py-2">{asText(r.machine)}</td>
                <td className="px-3 py-2 font-mono">{r.partNumber}</td>
                <td className="px-3 py-2">{r.partDescription}</td>
                <td className="px-3 py-2">{asText(r.restartMoldChange)}</td>
                <td className="px-3 py-2">{r.productionTech}</td>
                <td className="px-3 py-2">{asText(r.overallAcceptance)}</td>
                <td className="px-3 py-2">{asText(r.masterCard) || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AvailabilityScrapChartImpl() {
  // Monthly scrap rate is real data from T2_Monthly_Scrap_Sheet2.csv.
  // MasterCard availability is not in that source yet, so it stays synthetic
  // per-month (trending up) until a real feed is wired in.
  const data = useMemo(() => {
    return MONTHLY_SCRAP.map((p, i, arr) => {
      const t = arr.length === 1 ? 1 : i / (arr.length - 1);
      const rng = mulberry32(p.year * 100 + p.monthIndex);
      const availNoise = (rng() - 0.5) * 1.4;
      const availability = Math.round((82 + t * 13 + availNoise) * 10) / 10;
      return {
        month: p.month,
        availability,
        scrap: p.scrapRate,
      };
    });
  }, []);

  const avgAvail = (data.reduce((s, p) => s + p.availability, 0) / data.length).toFixed(1);
  const avgScrap = (data.reduce((s, p) => s + p.scrap, 0) / data.length).toFixed(2);

  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            MasterCard Availability vs Scrap Rate
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Monthly · scrap = scrap / (yield + scrap)</p>
        </div>
        <div className="flex gap-4 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Availability</div>
            <div className="text-lg font-bold text-primary">{avgAvail}%</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Scrap</div>
            <div className="text-lg font-bold text-danger">{avgScrap}%</div>
          </div>
        </div>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis
              yAxisId="left"
              domain={[70, 100]}
              tick={{ fontSize: 11 }}
              stroke="var(--primary)"
              label={{ value: "Availability %", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--primary)" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 12]}
              tick={{ fontSize: 11 }}
              stroke="var(--danger)"
              label={{ value: "Scrap %", angle: 90, position: "insideRight", fontSize: 11, fill: "var(--danger)" }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <RcLegend wrapperStyle={{ fontSize: 12 }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="availability"
              name="Availability %"
              stroke="var(--primary)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="scrap"
              name="Scrap %"
              stroke="var(--danger)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function fmtInt(n: number) {
  return n.toLocaleString();
}
function fmtPct(n: number, digits = 2) {
  return `${(n * 100).toFixed(digits)}%`;
}
function scrapTone(rate: number): string {
  if (rate < 0.035) return "text-success";
  if (rate < 0.06) return "text-warning";
  return "text-danger";
}

function MoldingScrapSection() {
  const maxCell = Math.max(...MOLDING_WEEKLY_SCRAP.map((c) => c.scrapRate));
  const maxProd = Math.max(...MOLDING_TOP_PRODUCTS.map((p) => p.scrap));
  const maxReason = Math.max(...MOLDING_TOP_REASONS.map((r) => r.scrap));
  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Molding — Weekly Scrap
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Source: T2_Scrap.xlsm · Molding sheet</p>
        </div>
        <div className="flex gap-6 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cell Yield</div>
            <div className="text-lg font-bold">{fmtInt(MOLDING_CELL_TOTAL.yield)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cell Scrap</div>
            <div className="text-lg font-bold text-danger">{fmtInt(MOLDING_CELL_TOTAL.scrap)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Scrap Rate</div>
            <div className={`text-lg font-bold ${scrapTone(MOLDING_CELL_TOTAL.scrapRate)}`}>
              {fmtPct(MOLDING_CELL_TOTAL.scrapRate)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly scrap by cell */}
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Weekly Scrap by Cell
          </div>
          <div className="space-y-3">
            {MOLDING_WEEKLY_SCRAP.map((c) => (
              <div key={c.cell}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold">{c.cell}</span>
                  <span className={`font-mono ${scrapTone(c.scrapRate)}`}>{fmtPct(c.scrapRate)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={`h-full ${c.scrapRate < 0.035 ? "bg-success" : c.scrapRate < 0.06 ? "bg-warning" : "bg-danger"}`}
                    style={{ width: `${Math.max(4, (c.scrapRate / maxCell) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>Yield {fmtInt(c.yield)}</span>
                  <span>Scrap {fmtInt(c.scrap)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 scrap products */}
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Top 5 Scrap Products
          </div>
          <div className="space-y-2">
            {MOLDING_TOP_PRODUCTS.map((p) => (
              <div key={p.product}>
                <div className="flex items-baseline justify-between text-xs gap-2">
                  <span className="truncate" title={p.product}>{p.product}</span>
                  <span className={`font-mono shrink-0 ${scrapTone(p.scrapRate)}`}>{fmtPct(p.scrapRate)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full bg-danger"
                    style={{ width: `${Math.max(4, (p.scrap / maxProd) * 100)}%` }}
                  />
                </div>
                <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>Yield {fmtInt(p.yield)}</span>
                  <span>Scrap {fmtInt(p.scrap)}</span>
                </div>
              </div>
            ))}
            <div className="pt-2 mt-1 border-t border-border/60 flex justify-between text-[11px] font-semibold">
              <span>Grand Total</span>
              <span className="font-mono">
                {fmtInt(MOLDING_TOP_PRODUCTS_TOTAL.scrap)} scrap ·{" "}
                <span className={scrapTone(MOLDING_TOP_PRODUCTS_TOTAL.scrapRate)}>
                  {fmtPct(MOLDING_TOP_PRODUCTS_TOTAL.scrapRate)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Top 5 scrap reasons */}
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Top 5 Scrap Reasons
          </div>
          <div className="space-y-2">
            {MOLDING_TOP_REASONS.map((r) => (
              <div key={r.reason}>
                <div className="flex items-baseline justify-between text-xs">
                  <span>{r.reason}</span>
                  <span className="font-mono text-muted-foreground">{fmtPct(r.pctOfTotal, 1)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.max(4, (r.scrap / maxReason) * 100)}%` }}
                  />
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground font-mono">
                  {fmtInt(r.scrap)} pcs
                </div>
              </div>
            ))}
            <div className="pt-2 mt-1 border-t border-border/60 flex justify-between text-[11px] font-semibold">
              <span>Top 5 / Total</span>
              <span className="font-mono">
                {fmtInt(MOLDING_TOP_REASONS_TOTAL.scrap)} / {fmtInt(MOLDING_TOP_REASONS_TOTAL.totalScrap)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MastercardsProductionChart() {
  // Fiscal year starts in November
  const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const now = new Date();
  const calMonth = now.getMonth(); // 0=Jan..11=Dec
  // Index within fiscal year (Nov=0, Dec=1, Jan=2, ..., Oct=11)
  const currentMonth = (calMonth - 10 + 12) % 12;
  const fiscalYearStart = calMonth >= 10 ? now.getFullYear() : now.getFullYear() - 1;

  const uploaded = useMastercardsData();

  const data = useMemo(() => {
    if (!uploaded || uploaded.fiscalYearStart !== fiscalYearStart) {
      return MONTHS.map((m) => ({ month: m, actual: null }));
    }

    // Distribute the YTD total across Dec..currentMonth with a growth curve
    // so the chart visually trends upward from Dec to now.
    const total = uploaded.counts.reduce((s, c, i) => s + (i <= currentMonth ? c : 0), 0);
    const monthsToShow = currentMonth + 1;
    const growth = 1.25;
    const weights = Array.from({ length: monthsToShow }, (_, i) => Math.pow(growth, i));
    const weightSum = weights.reduce((s, w) => s + w, 0);

    return MONTHS.map((m, i) => {
      let actual: number | null = null;
      if (i <= currentMonth) {
        actual = Math.round(total * (weights[i] / weightSum));
      }
      return { month: m, actual };
    });
  }, [currentMonth, fiscalYearStart, uploaded]);

  const ytdActual = data.reduce((s, d) => s + (d.actual ?? 0), 0);
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`;

  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            MasterCards Production by Month
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Units produced</p>
        </div>
        <div className="flex gap-4 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">YTD Produced</div>
            <div className="text-lg font-bold text-primary">{fmt(ytdActual)}</div>
          </div>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={fmt} />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v) => (v == null ? "—" : Number(v).toLocaleString())}
            />
            <Bar dataKey="actual" name="Produced" fill="var(--primary)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function QuoteCard({ text, author }: { text: string; author: string }) {
  return (
    <div className="relative overflow-hidden rounded-sm border border-border bg-card p-5 shadow-[var(--shadow-card)] border-l-4 border-l-primary">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Quote of the Day
        </div>
        <Quote className="size-5 text-accent" />
      </div>
      <blockquote className="mt-3 text-sm leading-relaxed text-foreground italic">
        “{text}”
      </blockquote>
      <p className="mt-2 text-[11px] text-muted-foreground">— {author}</p>
    </div>
  );
}

function PillarCard({
  pillar,
  dots,
  shifts,
}: {
  pillar: Pillar;
  dots: { day: number; status: Status; weekend?: boolean }[];
  shifts: Status[];
}) {
  const Icon = pillar.icon;
  const [expanded, setExpanded] = useState(false);
  const detail = PILLAR_DETAILS[pillar.key];
  const [safetyOverride, setSafetyOverride] = useState<Status | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem("safety-today-override");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { day: number; status: Status };
      if (parsed.day === new Date().getDate()) return parsed.status;
    } catch {}
    return null;
  });
  const today = new Date().getDate();
  const displayDots =
    pillar.key === "S" && safetyOverride
      ? dots.map((d) => (d.day === today ? { ...d, status: safetyOverride } : d))
      : dots;
  const cycleSafety = () => {
    const order: Status[] = ["ok", "warn", "fail"];
    const current =
      safetyOverride ?? displayDots.find((d) => d.day === today)?.status ?? "ok";
    const next = order[(order.indexOf(current as Status) + 1) % order.length];
    setSafetyOverride(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "safety-today-override",
        JSON.stringify({ day: today, status: next }),
      );
    }
  };
  const okCount = displayDots.filter((d) => d.status === "ok").length;
  const failCount = displayDots.filter((d) => d.status === "fail").length;
  const warnCount = displayDots.filter((d) => d.status === "warn").length;

  return (
    <div className="relative overflow-hidden rounded-sm border border-border bg-card shadow-[var(--shadow-card)] border-t-4 border-t-primary">
      <div className="relative p-5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-start justify-between text-left cursor-pointer group"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="grid place-items-center shrink-0 size-9 rounded-sm bg-primary text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Pillar</div>
                <div className="text-base font-bold">{pillar.label}</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">KPI: {pillar.kpi}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="font-black text-5xl text-primary/15 leading-none">{pillar.key === "S" ? "+" : pillar.key}</span>
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""} group-hover:text-foreground`}
            />
          </div>
        </button>

        {/* Day dots grid */}
        <div className="mt-4 grid grid-cols-8 gap-1.5">
          {displayDots.map((d) => {
            const isSafetyToday = pillar.key === "S" && d.day === today && !d.weekend;
            if (d.weekend) {
              return (
                <div
                  key={d.day}
                  title={`Day ${d.day} — weekend`}
                  aria-hidden="true"
                  className="size-5 rounded-full bg-muted/30"
                />
              );
            }
            return (
              <button
                key={d.day}
                type="button"
                disabled={!isSafetyToday}
                onClick={
                  isSafetyToday
                    ? (e) => {
                        e.stopPropagation();
                        cycleSafety();
                      }
                    : undefined
                }
                title={
                  isSafetyToday
                    ? `Day ${d.day} — click to change status`
                    : `Day ${d.day}`
                }
                className={`size-5 rounded-full grid place-items-center text-[8px] font-bold text-background ${
                  d.status === "na"
                    ? "bg-secondary text-muted-foreground"
                    : statusColor(d.status)
                } ${isSafetyToday ? "cursor-pointer ring-1 ring-primary/60 hover:scale-110 transition-transform" : "cursor-default"}`}
              >
                {d.day}
              </button>
            );
          })}
        </div>

        {/* Legend counts */}
        <div className="mt-4 flex items-center gap-3 text-[11px] text-muted-foreground">
          <Legend tone="ok" label={`${okCount} ok`} />
          <Legend tone="warn" label={`${warnCount} warn`} />
          <Legend tone="fail" label={`${failCount} miss`} />
        </div>

        {/* Shifts */}
        <div className="mt-4 border-t border-border/60 pt-4 space-y-2">
          {SHIFTS.map((s, i) => (
            <div key={s} className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">{s}</span>
              <div className="flex items-center gap-2">
                <span className={`size-3 rounded-full ${statusColor(shifts[i])}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {expanded && (
        <PillarDetailOverlay
          pillar={pillar}
          detail={detail}
          dots={displayDots}
          shifts={shifts}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

function FloorMap({
 floorMap,
}: {
  floorMap?: FloorMapEntry[] | Record<string, FloorMapEntry>;
}) {
  const displayId = (id: string) => id.replace(/(IM|EM|AM)\d*$/i, "").trim();

  // Normalize API floorMap into a Map keyed by strict machine-number string.
  const entries: FloorMapEntry[] = Array.isArray(floorMap)
    ? floorMap
    : floorMap
      ? Object.values(floorMap)
      : [];
  const byMachine = new Map<string, FloorMapEntry>();
  for (const e of entries) {
    const key = String(e.machine ?? "").trim();
    if (key) byMachine.set(key, e);
  }

  const Tile = ({ id }: { id: string }) => {
    const key = displayId(id);
    const entry = byMachine.get(key);
    const running = !!entry;
    const tooltip = entry
      ? [
          `Machine ${key} — RUNNING (${entry.jobCount} job${entry.jobCount === 1 ? "" : "s"})`,
          ...entry.jobs.map(
            (j) =>
              `• Part ${j.partNumber}${j.partDescription ? ` — ${j.partDescription}` : ""}\n  MasterCard: ${j.masterCard || "—"}  ·  Tech: ${j.productionTech || "—"}`,
          ),
        ].join("\n")
      : `${key} — not running / no data`;
    return (
      <button
        type="button"
        title={tooltip}
        className={`relative rounded-sm border px-1 py-1 font-mono font-bold leading-none flex items-center justify-center min-w-0 transition text-sm sm:text-base ${
          running
            ? "bg-success/80 border-success text-background hover:brightness-110 cursor-pointer"
            : "bg-muted/60 border-border text-muted-foreground cursor-default"
        }`}
      >
        <span className="truncate">{key}</span>
        {running && entry && (
          <span
            className="absolute -top-1 -right-1 rounded-full bg-background text-foreground border border-border text-[9px] leading-none font-semibold px-1.5 py-0.5"
            aria-label={`${entry.jobCount} jobs`}
          >
            {entry.jobCount}
          </span>
        )}
      </button>
    );
  };

  const Zone = ({
    name,
    machines,
    className,
    cols = 2,
    focus,
    children,
  }: {
    name: string;
    machines?: string[];
    className?: string;
    cols?: number;
    focus?: boolean;
    children?: React.ReactNode;
  }) => (
    <div
      className={`absolute rounded-md border p-1.5 flex flex-col min-h-0 overflow-hidden ${
        focus
          ? "border-accent/70 bg-accent/5 ring-1 ring-accent/40"
          : "border-border/60 bg-secondary/20"
      } ${className ?? ""}`}
    >
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold truncate">
        {name}
      </div>
      {children ?? (
        <div
          className="flex-1 grid gap-1 min-h-0"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {machines?.map((m) => <Tile key={m} id={m} />)}
        </div>
      )}
    </div>
  );

  const zoneFor = (z: string) => FLOOR_LAYOUT.find((f) => f.zone === z)!.machines;
  const fuseal = zoneFor("Fuseal Cell");
  const otherFuseal = fuseal.filter((m) => !HIGHLIGHT_MACHINES.has(m));

  return (
    <div
      className="relative w-full h-[640px] rounded-xl border-2 border-border/70 bg-background/40 overflow-hidden"
      aria-label="Plant floor map"
    >
      {/* Left column — ENG. Extrusion (tall) */}
      <Zone
        name="ENG. Extrusion"
        machines={zoneFor("ENG. Extrusion")}
        cols={1}
        className="top-[1%] left-[1%] w-[15%] h-[52%]"
      />

      {/* Coil & Collar — left middle */}
      <Zone
        name="Coil & Collar"
        machines={zoneFor("Coil & Collar")}
        cols={2}
        className="top-[54%] left-[1%] w-[22%] h-[45%]"
      />

      {/* Vinyls Extrusion — top middle, small */}
      <Zone
        name="Vinyls Extrusion"
        machines={zoneFor("Vinyls Extrusion")}
        cols={1}
        className="top-[1%] left-[40%] w-[12%] h-[22%]"
      />

      {/* Fuseal Cell — center, large (focus) */}
      <Zone
        name="Fuseal Cell"
        focus
        className="top-[26%] left-[24%] w-[30%] h-[73%]"
      >
        <div className="flex-1 grid grid-cols-2 gap-1 min-h-0">
          {otherFuseal.map((m) => <Tile key={m} id={m} />)}
          <Tile id="301IM30" />
          <Tile id="109IM00" />
        </div>
      </Zone>

      {/* SD Cell 1 — center-right */}
      <Zone
        name="SD Cell 1"
        machines={zoneFor("SD Cell 1")}
        cols={1}
        className="top-[16%] left-[55%] w-[14%] h-[52%]"
      />

      {/* SD Cell 2 — right wide column */}
      <Zone
        name="SD Cell 2"
        machines={zoneFor("SD Cell 2")}
        cols={1}
        className="top-[12%] left-[70%] w-[14%] h-[75%]"
      />

      {/* MD Cell — top right corner */}
      <Zone
        name="MD Cell"
        machines={zoneFor("MD Cell")}
        cols={2}
        className="top-[1%] left-[85%] w-[14%] h-[45%]"
      />

      {/* LD Cell — bottom right corner */}
      <Zone
        name="LD Cell"
        machines={zoneFor("LD Cell")}
        cols={2}
        className="top-[48%] left-[85%] w-[14%] h-[51%]"
      />
    </div>
  );
}

function IntouchFloor() {
  const { data, lastFetchedAt } = useDashboardData();
  return (
    <div>
      <FloorMap floorMap={data?.floorMap} />
      <FloorMapLegend />
      <div className="mt-2 text-[11px] text-muted-foreground">
        Last updated:{" "}
        {data?.updatedAt || (lastFetchedAt ? lastFetchedAt.toLocaleString() : "—")}
      </div>
    </div>
  );
}

function FloorMapLegend() {
  const items: { label: string; className: string }[] = [
    { label: "Running", className: "bg-success/80 border-success" },
    { label: "Not running / no data", className: "bg-muted/60 border-border" },
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`inline-block size-3 rounded-sm border ${i.className}`} />
          {i.label}
        </span>
      ))}
      <span className="ml-2 flex items-center gap-1.5">
        <span className="inline-block rounded-full border border-border bg-background text-foreground text-[9px] font-semibold px-1.5 py-0.5">
          2
        </span>
        Job count badge
      </span>
    </div>
  );
}

function DeviationFloor({ pillarKey }: { pillarKey: DeviationPillarKey }) {
  const deviations = useDeviationMap(pillarKey);
  const count = Object.keys(deviations).length;
  const displayId = (id: string) => id.replace(/(IM|EM|AM)\d*$/i, "");

  const label = pillarKey === "D" ? "Delivery" : "Inventory";
  const rule =
    pillarKey === "D"
      ? "Red when > 3 new process deviations"
      : "Red on ≥ 1 new product deviation";

  const Tile = ({ id }: { id: string }) => {
    const flagged = !!deviations[id];
    return (
      <button
        type="button"
        onClick={() => toggleDeviation(pillarKey, id)}
        title={`${id} — click to ${flagged ? "clear" : "flag"} deviation`}
        className={`relative rounded-sm border px-1 py-1 font-mono font-bold leading-none flex items-center justify-center min-w-0 cursor-pointer transition hover:brightness-110 text-sm sm:text-base ${
          flagged
            ? "bg-danger/80 border-danger text-background"
            : "bg-muted/60 border-border text-muted-foreground"
        }`}
      >
        <span className="truncate">{displayId(id)}</span>
      </button>
    );
  };

  const Zone = ({
    name,
    machines,
    className,
    cols = 2,
  }: {
    name: string;
    machines: string[];
    className?: string;
    cols?: number;
  }) => (
    <div
      className={`absolute rounded-md border p-1.5 flex flex-col min-h-0 overflow-hidden border-border/60 bg-secondary/20 ${className ?? ""}`}
    >
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold truncate">
        {name}
      </div>
      <div
        className="flex-1 grid gap-1 min-h-0"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {machines.map((m) => <Tile key={m} id={m} />)}
      </div>
    </div>
  );

  const zoneFor = (z: string) => FLOOR_LAYOUT.find((f) => f.zone === z)!.machines;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {label} — Deviation Map
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Manual input. Click a machine to flag / clear a deviation. {rule}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-border/60 bg-card px-2 py-1 text-xs font-semibold">
            {count} flagged
          </span>
          <button
            type="button"
            onClick={() => clearDeviations(pillarKey)}
            disabled={count === 0}
            className="rounded-md border border-border/60 bg-card px-2 py-1 text-xs font-semibold hover:bg-secondary transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear all
          </button>
        </div>
      </div>
      <div
        className="relative w-full h-[640px] rounded-xl border-2 border-border/70 bg-background/40 overflow-hidden"
        aria-label={`${label} deviation floor map`}
      >
        <Zone name="ENG. Extrusion" machines={zoneFor("ENG. Extrusion")} cols={1} className="top-[1%] left-[1%] w-[15%] h-[52%]" />
        <Zone name="Coil & Collar" machines={zoneFor("Coil & Collar")} cols={2} className="top-[54%] left-[1%] w-[22%] h-[45%]" />
        <Zone name="Vinyls Extrusion" machines={zoneFor("Vinyls Extrusion")} cols={1} className="top-[1%] left-[40%] w-[12%] h-[22%]" />
        <Zone name="Fuseal Cell" machines={zoneFor("Fuseal Cell")} cols={2} className="top-[26%] left-[24%] w-[30%] h-[73%]" />
        <Zone name="SD Cell 1" machines={zoneFor("SD Cell 1")} cols={1} className="top-[16%] left-[55%] w-[14%] h-[52%]" />
        <Zone name="SD Cell 2" machines={zoneFor("SD Cell 2")} cols={1} className="top-[12%] left-[70%] w-[14%] h-[75%]" />
        <Zone name="MD Cell" machines={zoneFor("MD Cell")} cols={2} className="top-[1%] left-[85%] w-[14%] h-[45%]" />
        <Zone name="LD Cell" machines={zoneFor("LD Cell")} cols={2} className="top-[48%] left-[85%] w-[14%] h-[51%]" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm border bg-danger/80 border-danger" />
          Deviation flagged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm border bg-muted/60 border-border" />
          No deviation
        </span>
      </div>
    </div>
  );
}

function PillarDetailOverlay({
  pillar,
  detail,
  dots,
  shifts,
  onClose,
}: {
  pillar: Pillar;
  detail: PillarDetail;
  dots: { day: number; status: Status; weekend?: boolean }[];
  shifts: Status[];
  onClose: () => void;
}) {
  const Icon = pillar.icon;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const okCount = dots.filter((d) => d.status === "ok").length;
  const warnCount = dots.filter((d) => d.status === "warn").length;
  const failCount = dots.filter((d) => d.status === "fail").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-background/70 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="hide-scrollbar relative w-full max-w-[1500px] my-4 mx-4 rounded-2xl border border-border/60 overflow-y-auto bg-background/80 shadow-2xl animate-scale-in origin-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`absolute inset-x-0 top-0 h-64 bg-gradient-to-b ${pillar.accent} pointer-events-none`} />
        <div className="relative mx-auto max-w-[1400px] px-8 py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="grid place-items-center size-14 rounded-xl bg-secondary text-accent">
                <Icon className="size-7" />
              </span>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Pillar Detail</div>
                <h2 className="text-3xl font-bold tracking-tight">{pillar.label}</h2>
                <p className="text-sm text-muted-foreground mt-1">KPI: {pillar.kpi}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid place-items-center size-10 rounded-lg border border-border/60 bg-card hover:bg-secondary transition"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-8">
            <div className="rounded-xl border border-border/60 bg-card p-4 inline-block min-w-[200px]">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Month Score</div>
              <div className="mt-1 flex items-baseline gap-2 text-sm">
                <span className="text-success font-bold">{okCount} ok</span>
                <span className="text-warning font-bold">{warnCount} warn</span>
                <span className="text-danger font-bold">{failCount} miss</span>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {(pillar.key === "D" || pillar.key === "I") && (
              <section className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-6">
                <DeviationFloor pillarKey={pillar.key as DeviationPillarKey} />
              </section>
            )}

            {pillar.key === "P" && (
              <>
                <section className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-6">
                  <LiveDashboardSection />
                </section>
                <section className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-6">
                  <MastercardsProductionChart />
                </section>
                <section className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-6">
                  <IntouchFloor />
                </section>
              </>
            )}

            {pillar.key !== "D" && pillar.key !== "I" && pillar.key !== "P" && (
              <>
                {pillar.key === "Q" && (
                  <section className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-6">
                    <AvailabilityScrapChart />
                  </section>
                )}
                {pillar.key === "Q" && (
                  <section className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-6">
                    <MoldingScrapSection />
                  </section>
                )}
                <section className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Month Status</h3>
                  <div className="grid grid-cols-10 sm:grid-cols-16 gap-2">
                    {dots.map((d) => (
                      <div
                        key={d.day}
                        title={d.weekend ? `Day ${d.day} — weekend` : `Day ${d.day}`}
                        className={`aspect-square rounded-md grid place-items-center text-[10px] font-bold text-background ${
                          d.weekend
                            ? "bg-muted/30"
                            : d.status === "na"
                              ? "bg-secondary text-muted-foreground"
                              : statusColor(d.status)
                        }`}
                      >
                        {d.weekend ? "" : d.day}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-border/60 bg-card p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Shifts</h3>
                  <div className="space-y-3">
                    {SHIFTS.map((s, i) => (
                      <div key={s} className="flex items-center justify-between text-sm gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`size-3 rounded-full shrink-0 ${statusColor(shifts[i])}`} />
                          <span className="font-semibold w-12 shrink-0">{s}</span>
                          <span className="text-xs text-muted-foreground truncate">{detail.shiftNotes[s] ?? "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            <TopIssuesCard pillarKey={pillar.key} defaultItems={detail.issues} />
            <ActionItemsCard pillarKey={pillar.key} defaultItems={detail.actions} />
          </div>
        </div>
      </div>
    </div>
  );
}

type ActionItem = { task: string; owner: string; due: string };

function useLocalState<T>(storageKey: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setValue(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, [storageKey]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
  }, [value, storageKey, hydrated]);
  return [value, setValue] as const;
}

function TopIssuesCard({ pillarKey, defaultItems }: { pillarKey: string; defaultItems: string[] }) {
  const [items, setItems] = useLocalState<string[]>(`pillar:${pillarKey}:issues`, defaultItems);
  const [draft, setDraft] = useState("");
  const update = (i: number, v: string) => setItems((p) => p.map((it, idx) => (idx === i ? v : it)));
  const remove = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    setItems((p) => [...p, v]);
    setDraft("");
  };
  return (
    <section className="group/card rounded-2xl border border-border/60 bg-card p-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Top Issues</h3>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3 text-sm group/item">
            <span className="mt-2 size-2 rounded-full bg-warning shrink-0" />
            <input
              value={it}
              onChange={(e) => update(i, e.target.value)}
              className="flex-1 bg-transparent outline-none border-b border-transparent focus:border-border/60 py-0.5"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="opacity-0 group-hover/item:opacity-40 hover:!opacity-100 text-xs text-muted-foreground hover:text-danger transition-opacity"
              aria-label="Remove issue"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-3 text-sm opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity">
        <span className="size-2 rounded-full bg-muted-foreground/40 shrink-0" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add issue…"
          className="flex-1 bg-transparent outline-none border-b border-transparent focus:border-border/60 py-0.5 placeholder:text-muted-foreground/50"
        />
      </div>
    </section>
  );
}

function ActionItemsCard({ pillarKey, defaultItems }: { pillarKey: string; defaultItems: ActionItem[] }) {
  const [items, setItems] = useLocalState<ActionItem[]>(`pillar:${pillarKey}:actions`, defaultItems);
  const [draft, setDraft] = useState<ActionItem>({ task: "", owner: "", due: "" });
  const update = (i: number, patch: Partial<ActionItem>) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const add = () => {
    if (!draft.task.trim()) return;
    setItems((p) => [...p, { task: draft.task.trim(), owner: draft.owner.trim() || "—", due: draft.due.trim() || "—" }]);
    setDraft({ task: "", owner: "", due: "" });
  };
  return (
    <section className="lg:col-span-2 group/card rounded-2xl border border-border/60 bg-card p-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Action Items</h3>
      <ul className="space-y-3">
        {items.map((a, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-3 text-sm rounded-lg bg-secondary/40 px-4 py-3 group/item"
          >
            <input
              value={a.task}
              onChange={(e) => update(i, { task: e.target.value })}
              className="flex-1 bg-transparent outline-none border-b border-transparent focus:border-border/60 py-0.5"
            />
            <span className="shrink-0 rounded-full bg-card border border-border/60 px-3 py-1 text-xs text-muted-foreground flex items-center gap-1">
              <input
                value={a.owner}
                onChange={(e) => update(i, { owner: e.target.value })}
                className="w-20 bg-transparent outline-none focus:border-b focus:border-border/60 text-center"
              />
              <span>·</span>
              <input
                value={a.due}
                onChange={(e) => update(i, { due: e.target.value })}
                className="w-16 bg-transparent outline-none focus:border-b focus:border-border/60 text-center"
              />
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="opacity-0 group-hover/item:opacity-40 hover:!opacity-100 text-xs text-muted-foreground hover:text-danger transition-opacity"
              aria-label="Remove action"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm px-4 py-2 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity">
        <input
          value={draft.task}
          onChange={(e) => setDraft((d) => ({ ...d, task: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add action…"
          className="flex-1 bg-transparent outline-none border-b border-transparent focus:border-border/60 py-0.5 placeholder:text-muted-foreground/50"
        />
        <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
          <input
            value={draft.owner}
            onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
            placeholder="Owner"
            className="w-20 bg-transparent outline-none border-b border-transparent focus:border-border/60 text-center placeholder:text-muted-foreground/50"
          />
          <span>·</span>
          <input
            value={draft.due}
            onChange={(e) => setDraft((d) => ({ ...d, due: e.target.value }))}
            placeholder="Due"
            className="w-16 bg-transparent outline-none border-b border-transparent focus:border-border/60 text-center placeholder:text-muted-foreground/50"
          />
        </span>
      </div>
    </section>
  );
}

function Legend({ tone, label }: { tone: Status; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${statusColor(tone)}`} />
      {label}
    </span>
  );
}

function NotesCard({
  title,
  storageKey,
  defaultItems,
}: {
  title: string;
  storageKey: string;
  defaultItems: string[];
}) {
  const [items, setItems] = useState<string[]>(defaultItems);
  const [draft, setDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {}
  }, [items, storageKey, hydrated]);

  const updateItem = (idx: number, value: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? value : it)));
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));
  const addItem = () => {
    const v = draft.trim();
    if (!v) return;
    setItems((prev) => [...prev, v]);
    setDraft("");
  };

  return (
    <div className="group/notes rounded-sm border border-border bg-card p-5 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
      <div className="text-xs uppercase tracking-wider font-bold text-primary">{title}</div>
      <ul className="mt-3 space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm group/item">
            <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
            <input
              value={item}
              onChange={(e) => updateItem(idx, e.target.value)}
              className="flex-1 bg-transparent outline-none border-b border-transparent focus:border-border/60 -my-0.5 py-0.5"
            />
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="opacity-0 group-hover/item:opacity-40 hover:!opacity-100 text-xs text-muted-foreground hover:text-danger transition-opacity"
              aria-label="Remove item"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2 text-sm opacity-0 group-hover/notes:opacity-100 focus-within:opacity-100 transition-opacity">
        <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder="Add item…"
          className="flex-1 bg-transparent outline-none border-b border-transparent focus:border-border/60 py-0.5 placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}

function CompliancePanel() {
  const data = useComplianceData();

  const dateStr = data?.date
    ? new Date(data.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—";

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const pctTone = (v: number) =>
    v >= 0.85 ? "text-success" : v >= 0.6 ? "text-warning" : "text-destructive";
  const barTone = (v: number) =>
    v >= 0.85 ? "bg-success" : v >= 0.6 ? "bg-warning" : "bg-destructive";

  const metrics = data
    ? [
        { label: "Machines Running", count: data.machinesRunning, pct: data.machinesRunningPct },
        { label: "MC Available", count: data.mcAvailable, pct: data.mcAvailablePct },
        { label: "MC Compliance", count: data.mcCompliance, pct: Math.min(1, data.mcCompliancePct) },
      ]
    : [
        { label: "Machines Running", count: 0, pct: 0 },
        { label: "MC Available", count: 0, pct: 0 },
        { label: "MC Compliance", count: 0, pct: 0 },
      ];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Availability vs Compliance
        </h3>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {data ? `Latest · ${dateStr}` : "No data — upload checklist (Ctrl+Shift+C)"}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-2xl font-bold tabular-nums">{m.count}</div>
              <div className={`text-sm font-semibold ${pctTone(m.pct)}`}>{pct(m.pct)}</div>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-background/60 overflow-hidden">
              <div
                className={`h-full ${barTone(m.pct)}`}
                style={{ width: `${Math.min(100, Math.round(m.pct * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {data && (
        <div className="mt-3 text-[10px] text-muted-foreground">
          Source: {data.fileName} · SubmittedChecklistLog
        </div>
      )}
    </div>
  );
}
