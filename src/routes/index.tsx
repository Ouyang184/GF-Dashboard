import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useIntouchSnapshot, type IntouchSnapshot } from "@/hooks/use-intouch-snapshot";
import { CopilotSyncPanel } from "@/components/intouch/CopilotSyncPanel";
import { useFloorOverrides, setFloorOverride, useDeviationCount } from "@/hooks/use-floor-overrides";
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
  Ticket,
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
  { key: "S", label: "Safety", kpi: "0 Equip Safety Issues", icon: Shield, accent: "from-emerald-400/20 to-emerald-400/0" },
  { key: "Q", label: "Quality", kpi: "Weekly Scrap ≥ 5%", icon: BadgeCheck, accent: "from-sky-400/20 to-sky-400/0" },
  { key: "D", label: "Delivery", kpi: "≥ 3 New Process Deviations", icon: Truck, accent: "from-amber-400/20 to-amber-400/0" },
  { key: "I", label: "Inventory", kpi: "0 New Product Deviations", icon: Box, accent: "from-fuchsia-400/20 to-fuchsia-400/0" },
  { key: "P", label: "Productivity", kpi: "Machine Downtime", icon: Gauge, accent: "from-cyan-400/20 to-cyan-400/0" },
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
  const dots: { day: number; status: Status }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (d > today.getDate()) {
      dots.push({ day: d, status: "na" });
    } else {
      dots.push({ day: d, status: pickStatus(rng) });
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
  dots: { day: number; status: Status }[],
  pillarKey: string,
  deviationCount: number,
) {
  const today = new Date().getDate();
  const trigger =
    (pillarKey === "I" && deviationCount >= 1) ||
    (pillarKey === "D" && deviationCount > 3);
  if (!trigger) return dots;
  return dots.map((d) => (d.day === today ? { ...d, status: "fail" as Status } : d));
}

function dailyLottery() {
  const today = new Date();
  const rng = mulberry32(dateSeed(today, 777));
  const pool = new Set<number>();
  while (pool.size < 5) pool.add(1 + Math.floor(rng() * 69));
  const numbers = [...pool].sort((a, b) => a - b);
  const power = 1 + Math.floor(rng() * 26);
  return { numbers, power };
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
  const lottery = useMemo(dailyLottery, []);
  const deviationCount = useDeviationCount();

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
          <StatCard label="Open Escalations" value="2" sub="1 active · 1 monitoring" icon={AlertTriangle} tone="warn" />
          <LotteryCard numbers={lottery.numbers} power={lottery.power} />
        </section>

        {/* QDIP grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {PILLARS.map((p, i) => (
            <PillarCard
              key={p.key}
              pillar={p}
              dots={applyDeviationRule(buildMonthDots(i, daysInMonth), p.key, deviationCount)}
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
  const data = useMemo(() => {
    const today = new Date();
    const points: { day: string; availability: number; scrap: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const rng = mulberry32(dateSeed(d, 4242));
      // Clear divergence: availability trends UP, scrap trends DOWN over 30 days
      const t = (29 - i) / 29; // 0 -> 1 across the window
      const availNoise = (rng() - 0.5) * 1.4;
      const scrapNoise = (rng() - 0.5) * 0.5;
      const availability = Math.round((82 + t * 13 + availNoise) * 10) / 10; // ~82 -> ~95
      const scrap = Math.max(0.6, Math.round((6.2 - t * 4.8 + scrapNoise) * 10) / 10); // ~6.2 -> ~1.4
      points.push({
        day: `${d.getMonth() + 1}/${d.getDate()}`,
        availability,
        scrap,
      });
    }
    return points;
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
          <p className="text-xs text-muted-foreground mt-1">Rolling 30 days · inverse correlation</p>
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
            <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
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
              domain={[0, 10]}
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

function MastercardsProductionChart() {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const currentMonth = now.getMonth();

  const data = useMemo(() => {
    return MONTHS.map((m, i) => {
      const rng = mulberry32(dateSeed(new Date(now.getFullYear(), i, 1), 7700 + i));
      // Target ~120k units/month; actuals vary; future months null
      const target = 120000;
      const actual = i <= currentMonth
        ? Math.round(target * (0.82 + rng() * 0.28))
        : null;
      return { month: m, actual, target };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  const monthlyTarget = 120000;
  const ytdActual = data.reduce((s, d) => s + (d.actual ?? 0), 0);
  const ytdTarget = monthlyTarget * (currentMonth + 1);
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`;

  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            MasterCards Production by Month
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Units produced vs monthly target</p>
        </div>
        <div className="flex gap-4 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">YTD Actual</div>
            <div className="text-lg font-bold text-primary">{fmt(ytdActual)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">YTD Target</div>
            <div className="text-lg font-bold text-foreground">{fmt(ytdTarget)}</div>
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
            <RcLegend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="target" name="Target" fill="color-mix(in oklch, var(--muted-foreground) 55%, transparent)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="actual" name="Actual" fill="var(--primary)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LotteryCard({ numbers, power }: { numbers: number[]; power: number }) {
  return (
    <div className="relative overflow-hidden rounded-sm border border-border bg-card p-5 shadow-[var(--shadow-card)] border-l-4 border-l-primary">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Lottery Pick of the Day</div>
        <Ticket className="size-5 text-accent" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {numbers.map((n) => (
          <span
            key={n}
            className="grid place-items-center size-10 rounded-sm border border-border bg-background text-primary font-mono font-bold tabular-nums"
          >
            {n.toString().padStart(2, "0")}
          </span>
        ))}
        <span className="grid place-items-center size-10 rounded-sm bg-warning text-primary font-mono font-bold tabular-nums">
          {power.toString().padStart(2, "0")}
        </span>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">For fun only · refreshes daily</p>
    </div>
  );
}

function PillarCard({
  pillar,
  dots,
  shifts,
}: {
  pillar: Pillar;
  dots: { day: number; status: Status }[];
  shifts: Status[];
}) {
  const Icon = pillar.icon;
  const [expanded, setExpanded] = useState(false);
  const detail = PILLAR_DETAILS[pillar.key];
  const okCount = dots.filter((d) => d.status === "ok").length;
  const failCount = dots.filter((d) => d.status === "fail").length;
  const warnCount = dots.filter((d) => d.status === "warn").length;

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
              <span
                className={
                  pillar.key === "Q"
                    ? "grid place-items-center size-9 rounded-sm bg-sky-50 text-sky-700 border border-sky-200 p-1.5"
                    : "grid place-items-center size-9 rounded-sm bg-primary text-primary-foreground"
                }
              >
                <Icon className={pillar.key === "Q" ? "size-[18px]" : "size-5"} />
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
          {dots.map((d) => (
            <div
              key={d.day}
              title={`Day ${d.day}`}
              className={`size-5 rounded-full grid place-items-center text-[8px] font-bold text-background ${
                d.status === "na" ? "bg-secondary text-muted-foreground" : statusColor(d.status)
              }`}
            >
              {d.day}
            </div>
          ))}
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
          dots={dots}
          shifts={shifts}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

function FloorMap({ ocr }: { ocr?: IntouchSnapshot | null }) {
  const overrides = useFloorOverrides();
  const STATUS_CYCLE: Array<Status | "qc"> = ["ok", "warn", "fail", "qc", "na"];
  const displayId = (id: string) => id.replace(/(IM|EM|AM)\d*$/i, "");

  // Deterministic status per machine id
  const fallback = (id: string): Status => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    const r = mulberry32(Math.abs(h))();
    if (r < 0.55) return "ok";
    if (r < 0.78) return "warn";
    if (r < 0.92) return "fail";
    return "na";
  };

  const statusFor = (id: string): Status | "qc" => {
    if (overrides[id]) return overrides[id];
    const live = ocr?.results[id]?.status;
    if (!live) return fallback(id);
    return live;
  };

  const tileColor = (s: Status | "qc") => {
    switch (s) {
      case "ok":
        return "bg-success/80 border-success";
      case "warn":
        return "bg-warning/80 border-warning";
      case "fail":
        return "bg-danger/80 border-danger";
      case "qc":
        return "bg-purple-500/70 border-purple-400";
      default:
        return "bg-sky-500/70 border-sky-400";
    }
  };

  const Tile = ({ id }: { id: string }) => {
    const s = statusFor(id);
    const cycle = () => {
      const idx = STATUS_CYCLE.indexOf(s);
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      setFloorOverride(id, next);
    };
    return (
      <button
        type="button"
        onClick={cycle}
        title={`${id} — click to change status`}
        className={`relative rounded-sm border px-1 py-1 font-mono font-bold text-background leading-none flex items-center justify-center min-w-0 cursor-pointer transition hover:brightness-110 text-sm sm:text-base ${tileColor(s)}`}
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
  const sync = useIntouchSnapshot();
  return (
    <div>
      <CopilotSyncPanel {...sync} />
      <FloorMap ocr={sync.snapshot} />
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
  dots: { day: number; status: Status }[];
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

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {detail.stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-2xl font-bold">{s.value}</div>
              </div>
            ))}
            <div className="rounded-xl border border-border/60 bg-card p-4">
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
                <IntouchFloor />
              </section>
            )}

            {pillar.key === "P" && (
              <>
                <section className="lg:col-span-3 rounded-2xl border border-border/60 bg-card p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3">
                      <CompliancePanel />
                    </div>
                    <div className="lg:col-span-2 lg:border-l lg:border-border/60 lg:pl-6">
                      <MastercardsProductionChart />
                    </div>
                  </div>
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
                <section className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Month Status</h3>
                  <div className="grid grid-cols-10 sm:grid-cols-16 gap-2">
                    {dots.map((d) => (
                      <div
                        key={d.day}
                        title={`Day ${d.day}`}
                        className={`aspect-square rounded-md grid place-items-center text-[10px] font-bold text-background ${
                          d.status === "na" ? "bg-secondary text-muted-foreground" : statusColor(d.status)
                        }`}
                      >
                        {d.day}
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
  const availabilityLeaves = [
    "Matching: 7",
    "Comparable: 3",
    "Downtime alerts",
  ];
  const complianceLeaves = [
    "6 of 10 available",
    "Repro: 6/18 (33%)",
    "2 MC in cabinet",
  ];
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">
        Availability vs Compliance
      </h3>
      <div className="flex flex-col items-center">
        {/* Root */}
        <div className="rounded-xl border border-border/60 bg-card px-6 py-3 shadow-[var(--shadow-card)] text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pillar</div>
          <div className="text-lg font-bold text-primary">Productivity</div>
        </div>

        {/* Vertical trunk */}
        <div className="h-6 w-px bg-border" />

        {/* Horizontal bar spanning both branches */}
        <div className="relative w-full max-w-2xl">
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-border" />
          <div className="grid grid-cols-2">
            {/* Availability branch */}
            <div className="flex flex-col items-center">
              <div className="h-6 w-px bg-border" />
              <div className="rounded-xl border border-border/60 bg-card px-5 py-3 shadow-[var(--shadow-card)] text-center border-t-2 border-t-warning">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Availability</div>
                <div className="text-xl font-bold text-warning">55%</div>
              </div>
              <div className="h-4 w-px bg-border" />
              <ul className="w-full max-w-[240px] space-y-2">
                {availabilityLeaves.map((leaf) => (
                  <li
                    key={leaf}
                    className="flex items-center gap-2 rounded-md border border-border/40 bg-background/60 px-3 py-1.5 text-xs"
                  >
                    <span className="size-1.5 rounded-full bg-warning shrink-0" />
                    <span>{leaf}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Compliance branch */}
            <div className="flex flex-col items-center">
              <div className="h-6 w-px bg-border" />
              <div className="rounded-xl border border-border/60 bg-card px-5 py-3 shadow-[var(--shadow-card)] text-center border-t-2 border-t-success">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Compliance</div>
                <div className="text-xl font-bold text-success">80%</div>
              </div>
              <div className="h-4 w-px bg-border" />
              <ul className="w-full max-w-[240px] space-y-2">
                {complianceLeaves.map((leaf) => (
                  <li
                    key={leaf}
                    className="flex items-center gap-2 rounded-md border border-border/40 bg-background/60 px-3 py-1.5 text-xs"
                  >
                    <span className="size-1.5 rounded-full bg-success shrink-0" />
                    <span>{leaf}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
