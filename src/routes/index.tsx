import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Box,
  ChevronDown,
  Cloud,
  CloudRain,
  CloudSnow,
  Gauge,
  Shield,
  Sparkles,
  Sun,
  Ticket,
  Truck,
  X,
} from "lucide-react";

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
  { key: "Q", label: "Quality", kpi: "Weekly Scrap ≥ 5%", icon: Sparkles, accent: "from-sky-400/20 to-sky-400/0" },
  { key: "D", label: "Delivery", kpi: "≥ 3 New Process Deviations", icon: Truck, accent: "from-amber-400/20 to-amber-400/0" },
  { key: "I", label: "Inventory", kpi: "0 New Product Deviations", icon: Box, accent: "from-fuchsia-400/20 to-fuchsia-400/0" },
  { key: "P", label: "Productivity", kpi: "Machine Downtime", icon: Gauge, accent: "from-cyan-400/20 to-cyan-400/0" },
];

const SHIFTS = ["LD", "MD", "SD1", "SD2", "FS", "PA&F", "EXT"] as const;

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
            <div className="size-10 rounded-xl bg-[var(--gradient-accent)] grid place-items-center text-primary-foreground font-black shadow-[var(--shadow-glow)]">
              A
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
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Month" value={monthName || "—"} sub={liveNow ? `Day ${now.getDate()} / ${daysInMonth}` : ""} icon={Activity} />
          <StatCard label="Open Escalations" value="2" sub="1 active · 1 monitoring" icon={AlertTriangle} tone="warn" />
          <StatCard label="MasterCard Compliance" value="80%" sub="6 of 10 available" icon={Shield} tone="ok" />
          <LotteryCard numbers={lottery.numbers} power={lottery.power} />
        </section>

        {/* QDIP grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {PILLARS.map((p, i) => (
            <PillarCard
              key={p.key}
              pillar={p}
              dots={buildMonthDots(i, daysInMonth)}
              shifts={shiftStatuses[i]}
            />
          ))}
        </section>

        {/* Footer notes */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <NotesCard
            title="Open Escalations"
            items={[
              "Mold lockers not being returned",
              "PVL/LPVL grinder blades damaged by metal tools",
            ]}
          />
          <NotesCard
            title="Long Term Actions"
            items={[
              "Repro compliance: 6/18 = 33%",
              "4 reprints made (10 → 14, 78%)",
              "2 MC in cabinet but not on machine",
            ]}
          />
          <NotesCard
            title="Availability vs Compliance"
            items={["Availability: 55%", "Compliance: 80%", "Matching: 7 · Comparable: 3"]}
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
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-accent/5 blur-2xl" />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <Icon className={`size-5 ${toneCls}`} />
      </div>
    </div>
  );
}

function LotteryCard({ numbers, power }: { numbers: number[]; power: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-[var(--gradient-hero)] p-5 shadow-[var(--shadow-card)]">
      <div className="absolute -right-10 -bottom-10 size-40 rounded-full bg-accent/15 blur-2xl" />
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Lottery Pick of the Day</div>
        <Ticket className="size-5 text-accent" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {numbers.map((n) => (
          <span
            key={n}
            className="grid place-items-center size-10 rounded-full bg-card font-mono font-bold tabular-nums border border-border/80"
          >
            {n.toString().padStart(2, "0")}
          </span>
        ))}
        <span className="grid place-items-center size-10 rounded-full bg-accent text-accent-foreground font-mono font-bold tabular-nums shadow-[0_0_18px_var(--accent)]">
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
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${pillar.accent} pointer-events-none`} />
      <div className="relative p-5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-start justify-between text-left cursor-pointer group"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="grid place-items-center size-9 rounded-lg bg-secondary text-accent">
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
            <span className="font-black text-5xl text-foreground/10 leading-none">{pillar.key}</span>
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
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full overflow-y-auto bg-background"
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

            <section className="rounded-2xl border border-border/60 bg-card p-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Top Issues</h3>
              <ul className="space-y-3">
                {detail.issues.map((it) => (
                  <li key={it} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 size-2 rounded-full bg-warning shrink-0" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Action Items</h3>
              <ul className="space-y-3">
                {detail.actions.map((a) => (
                  <li key={a.task} className="flex items-center justify-between gap-3 text-sm rounded-lg bg-secondary/40 px-4 py-3">
                    <span className="flex-1">{a.task}</span>
                    <span className="shrink-0 rounded-full bg-card border border-border/60 px-3 py-1 text-xs text-muted-foreground">
                      {a.owner} · {a.due}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
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

function NotesCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 size-1.5 rounded-full bg-accent shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
