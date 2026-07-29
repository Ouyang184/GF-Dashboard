import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  buildAlerts,
  buildDowntime,
  buildFleet,
  buildPm,
  buildSpares,
  buildWorkOrders,
  useTick,
  type Alert,
  type MachineStatus,
  type MachineTelemetry,
  type WorkOrder,
} from "@/data/maintenance-mock";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance · Command Center — AMG" },
      {
        name: "description",
        content:
          "Real-time maintenance command center for the AMG plant: fleet health, live telemetry, alerts, work orders, predictive risk, spares, and PM schedule.",
      },
      { property: "og:title", content: "Maintenance · Command Center — AMG" },
      {
        property: "og:description",
        content:
          "Live machine telemetry, predictive alerts, and work-order queue for AMG maintenance operations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MaintenancePage,
});

/* ------------------------------ page frame ------------------------------ */

const FONT_STACK = { fontFamily: "'Space Grotesk', system-ui, sans-serif" };
const MONO_STACK = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };

function StatusColor(s: MachineStatus): string {
  return s === "run"
    ? "#4ecb8a"
    : s === "warn"
      ? "#e8b464"
      : s === "down"
        ? "#e5556b"
        : "#6a7690";
}

function Panel({
  title,
  right,
  children,
  className = "",
  delay = 0,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section
      className={`maint-panel rounded-md p-4 maint-motion ${className}`}
      style={{
        animation: `maint-boot 700ms ${delay}ms cubic-bezier(.2,.8,.2,1) both`,
      }}
    >
      <header className="flex items-center justify-between mb-4 pb-2.5 border-b border-[#1e2636]">
        <h2
          className="text-[11px] font-semibold tracking-[0.2em] text-white/90 uppercase flex items-center gap-2.5"
          style={MONO_STACK}
        >
          <span className="inline-block w-[3px] h-3 bg-[#6ea8ff] rounded-sm" />
          {title}
        </h2>
        {right}
      </header>
      {children}
    </section>
  );
}

/* ------------------------------ header ---------------------------------- */

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function TypewriterLine({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, 24);
    return () => clearInterval(id);
  }, [text]);
  return (
    <span style={MONO_STACK} className="text-[#4ecb8a]">
      {text.slice(0, n)}
      <span
        className="inline-block w-[7px] h-[12px] bg-[#4ecb8a] align-middle ml-0.5"
        style={{ animation: "maint-caret 900ms steps(1) infinite" }}
      />
    </span>
  );
}

function TopBar() {
  const now = useClock();
  const timeStr = now
    ? now.toLocaleTimeString([], { hour12: false })
    : "--:--:--";
  const dateStr = now
    ? now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
    : "";
  const shift = now
    ? now.getHours() >= 7 && now.getHours() < 19
      ? "SHIFT · A"
      : "SHIFT · B"
    : "";
  return (
    <header className="relative border-b border-[#1e2636] bg-[#0a0d14]/90 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-[1700px] px-6 py-3 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="relative w-10 h-10 grid place-items-center rounded-md border border-[#6ea8ff]/50 bg-[#6ea8ff]/10">
            <div
              className="absolute inset-1 rounded-sm border border-[#6ea8ff]/40"
              style={{ animation: "maint-radar 6s linear infinite" }}
            />
            <span className="text-[#6ea8ff] font-black" style={MONO_STACK}>
              MX
            </span>
          </div>
          <div>
            <h1
              className="text-lg font-bold tracking-[0.35em] text-white leading-none"
              style={FONT_STACK}
            >
              MAINTENANCE · COMMAND CENTER
            </h1>
            <div className="text-[10px] mt-1 tracking-[0.3em] text-[#6a7690] uppercase">
              AMG PLANT / OPS.MX.NODE.01
            </div>
          </div>
        </div>

        <div className="hidden md:block flex-1 min-w-0 mx-4 text-xs truncate">
          <TypewriterLine
            text={`SYSTEM ONLINE · TELEMETRY LINK ESTABLISHED · ${timeStr} UTC-6 · ALL SUBSYSTEMS NOMINAL`}
          />
        </div>

        <div className="flex items-center gap-4">
          <div
            className="px-3 py-1.5 rounded border border-[#e8b464]/50 bg-[#e8b464]/10 text-[#e8b464] text-[10px] tracking-[0.25em] font-semibold"
            style={MONO_STACK}
          >
            {shift}
          </div>
          <div className="text-right">
            <div
              className="font-bold text-2xl tabular-nums text-white leading-none"
              style={MONO_STACK}
              suppressHydrationWarning
            >
              {timeStr}
            </div>
            <div
              className="text-[10px] text-[#6a7690] tracking-widest uppercase mt-1"
              suppressHydrationWarning
            >
              {dateStr}
            </div>
          </div>
          <Link
            to="/"
            className="px-3 py-2 rounded border border-[#1e2636] hover:border-[#6ea8ff]/60 hover:bg-[#6ea8ff]/5 text-[11px] tracking-[0.25em] text-white/80 hover:text-white transition"
            style={MONO_STACK}
          >
            ← QDIP
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------ fleet health gauge ---------------------- */

function FleetHealthGauge({ fleet }: { fleet: MachineTelemetry[] }) {
  const running = fleet.filter((m) => m.status === "run").length;
  const total = fleet.length;
  const pct = total ? Math.round((running / total) * 100) : 0;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = display;
    const to = pct;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      setDisplay(Math.round(from + (to - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct]);

  const R = 78;
  const C = 2 * Math.PI * R;
  const off = C - (display / 100) * C;

  const down = fleet.filter((m) => m.status === "down").length;
  const warn = fleet.filter((m) => m.status === "warn").length;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[200px] h-[200px]">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id="gaugeStroke" x1="0" x2="1">
              <stop offset="0%" stopColor="#6ea8ff" />
              <stop offset="100%" stopColor="#4ecb8a" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r={R} stroke="#1e2636" strokeWidth="8" fill="none" />
          <circle
            cx="100"
            cy="100"
            r={R}
            stroke="url(#gaugeStroke)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={off}
            style={{ transition: "stroke-dashoffset 0.4s ease" }}
          />
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i / 60) * Math.PI * 2;
            const x1 = 100 + Math.cos(a) * 92;
            const y1 = 100 + Math.sin(a) * 92;
            const x2 = 100 + Math.cos(a) * (i % 5 === 0 ? 84 : 88);
            const y2 = 100 + Math.sin(a) * (i % 5 === 0 ? 84 : 88);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#1e2636"
                strokeWidth={i % 5 === 0 ? 1.5 : 1}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div
              className="text-5xl font-bold text-white tabular-nums leading-none"
              style={MONO_STACK}
            >
              {display}
              <span className="text-[#6ea8ff] text-2xl">%</span>
            </div>
            <div className="text-[10px] tracking-[0.3em] text-[#6a7690] mt-2 uppercase">
              FLEET HEALTH
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 w-full text-center">
        <div>
          <div className="text-[#4ecb8a] text-xl font-bold tabular-nums" style={MONO_STACK}>
            {running}
          </div>
          <div className="text-[9px] tracking-widest text-[#6a7690] mt-0.5">RUN</div>
        </div>
        <div>
          <div className="text-[#e8b464] text-xl font-bold tabular-nums" style={MONO_STACK}>
            {warn}
          </div>
          <div className="text-[9px] tracking-widest text-[#6a7690] mt-0.5">WARN</div>
        </div>
        <div>
          <div className="text-[#e5556b] text-xl font-bold tabular-nums" style={MONO_STACK}>
            {down}
          </div>
          <div className="text-[9px] tracking-widest text-[#6a7690] mt-0.5">DOWN</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ telemetry wall -------------------------- */

function Waveform({ data, color }: { data: number[]; color: string }) {
  const w = 100;
  const h = 26;
  const step = w / (data.length - 1);
  const path = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - v * h}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-6" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth={1} opacity={0.9} />
      <path
        d={`${path} L ${w} ${h} L 0 ${h} Z`}
        fill={color}
        opacity={0.12}
      />
    </svg>
  );
}

function MachineTile({ m }: { m: MachineTelemetry }) {
  const c = StatusColor(m.status);
  return (
    <div
      className="relative rounded border border-[#1e2636] bg-[#0b111c]/90 p-2 hover:border-[#6ea8ff]/50 transition"
      style={m.status === "down" ? { animation: "maint-pulse-glow 2s ease-in-out infinite" } : undefined}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-white truncate" style={MONO_STACK}>
          {m.id}
        </span>
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: c,
            boxShadow: `0 0 8px ${c}`,
            animation: m.status === "run" ? "maint-blink 1.4s infinite" : undefined,
          }}
        />
      </div>
      <Waveform data={m.waveform} color={c} />
      <div className="flex justify-between text-[9px] mt-1" style={MONO_STACK}>
        <span className="text-[#6a7690]">
          {m.tempC}°C · {m.pressBar}b
        </span>
        <span style={{ color: c }}>{m.uptimePct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function TelemetryWall({ fleet }: { fleet: MachineTelemetry[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
      {fleet.map((m) => (
        <MachineTile key={m.id} m={m} />
      ))}
    </div>
  );
}

/* ------------------------------ alerts ---------------------------------- */

function AlertRow({ a }: { a: Alert }) {
  const c =
    a.severity === "crit" ? "#e5556b" : a.severity === "warn" ? "#e8b464" : "#6ea8ff";
  const rel = timeAgo(a.ts);
  return (
    <div
      className="flex items-center gap-2 py-1.5 px-2 border-l-2 bg-[#0b111c]/60"
      style={{ borderColor: c, animation: "maint-slide-in 400ms ease both" }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: c, boxShadow: `0 0 6px ${c}` }}
      />
      <span className="text-[10px] text-[#6a7690] tabular-nums w-10 shrink-0" style={MONO_STACK}>
        {rel}
      </span>
      <span className="text-[10px] font-bold text-white w-16 shrink-0 truncate" style={MONO_STACK}>
        {a.machine}
      </span>
      <span className="text-[11px] text-white/85 truncate">{a.msg}</span>
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function AlertStream({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="flex flex-col gap-1 max-h-[380px] overflow-y-auto hide-scrollbar">
      {alerts.map((a) => (
        <AlertRow key={a.id} a={a} />
      ))}
    </div>
  );
}

/* ------------------------------ KPI counters ---------------------------- */

function Counter({
  value,
  suffix = "",
  label,
  color = "#6ea8ff",
}: {
  value: number;
  suffix?: string;
  label: string;
  color?: string;
}) {
  const [d, setD] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = d;
    const to = value;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 800);
      const e = 1 - Math.pow(1 - k, 3);
      setD(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative rounded border border-[#1e2636] bg-[#0b111c] p-4 overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div className="text-[9px] tracking-[0.3em] text-[#6a7690] uppercase">{label}</div>
      <div
        className="mt-1 text-3xl font-bold tabular-nums leading-none"
        style={{ ...MONO_STACK, color }}
      >
        {d.toFixed(1)}
        <span className="text-base opacity-60 ml-1">{suffix}</span>
      </div>
    </div>
  );
}

function KpiCounters({ fleet }: { fleet: MachineTelemetry[] }) {
  const avgUptime =
    fleet.reduce((s, m) => s + m.uptimePct, 0) / Math.max(1, fleet.length);
  const mtbf = 148 + (avgUptime - 85) * 4;
  const mttr = 42 - (avgUptime - 85) * 0.6;
  const oee = avgUptime * 0.92;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Counter value={mtbf} suffix="h" label="MTBF" color="#6ea8ff" />
      <Counter value={mttr} suffix="min" label="MTTR" color="#e8b464" />
      <Counter value={oee} suffix="%" label="OEE" color="#4ecb8a" />
      <Counter value={avgUptime} suffix="%" label="AVG UPTIME" color="#a78bfa" />
    </div>
  );
}

/* ------------------------------ pareto ---------------------------------- */

function DowntimePareto({ tick }: { tick: number }) {
  const data = useMemo(() => buildDowntime(tick), [tick]);
  const max = Math.max(...data.map((d) => d.minutes));
  return (
    <div className="flex flex-col gap-1.5">
      {data.map((d, i) => {
        const pct = (d.minutes / max) * 100;
        const color = i === 0 ? "#e5556b" : i < 3 ? "#e8b464" : "#6ea8ff";
        return (
          <div key={d.reason} className="flex items-center gap-2 text-[11px]">
            <div className="w-28 shrink-0 truncate text-white/80" style={MONO_STACK}>
              {d.reason}
            </div>
            <div className="flex-1 h-4 rounded-sm bg-[#0b111c] border border-[#1e2636] overflow-hidden relative">
              <div
                className="h-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${color}66, ${color})`,
                }}
              />
              <div
                className="absolute inset-y-0 w-8 opacity-40 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                  animation: `maint-sweep 3s ${i * 0.4}s linear infinite`,
                }}
              />
            </div>
            <div
              className="w-14 text-right tabular-nums text-white/80"
              style={MONO_STACK}
            >
              {d.minutes}m
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ kanban ---------------------------------- */

function WoCard({ w }: { w: WorkOrder }) {
  const pc = w.priority === "P1" ? "#e5556b" : w.priority === "P2" ? "#e8b464" : "#6ea8ff";
  return (
    <div className="rounded border border-[#1e2636] bg-[#0b111c] p-2 hover:border-[#6ea8ff]/40 transition">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-white" style={MONO_STACK}>
          {w.id}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider"
          style={{ color: pc, border: `1px solid ${pc}55`, background: `${pc}12` }}
        >
          {w.priority}
        </span>
      </div>
      <div className="text-[11px] text-white/85 line-clamp-2">{w.title}</div>
      <div className="mt-1 flex justify-between text-[9px] text-[#6a7690]" style={MONO_STACK}>
        <span>{w.machine}</span>
        <span>{w.tech} · {w.eta}</span>
      </div>
    </div>
  );
}

function WorkOrderKanban({ wos }: { wos: WorkOrder[] }) {
  const cols: { key: WorkOrder["status"]; label: string; color: string }[] = [
    { key: "open", label: "OPEN", color: "#e5556b" },
    { key: "progress", label: "IN PROGRESS", color: "#e8b464" },
    { key: "done", label: "COMPLETE", color: "#4ecb8a" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {cols.map((c) => {
        const items = wos.filter((w) => w.status === c.key);
        return (
          <div key={c.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-[9px] tracking-[0.25em] font-semibold"
                style={{ ...MONO_STACK, color: c.color }}
              >
                {c.label}
              </span>
              <span className="text-[9px] text-[#6a7690] tabular-nums" style={MONO_STACK}>
                {items.length.toString().padStart(2, "0")}
              </span>
            </div>
            {items.map((w) => (
              <WoCard key={w.id} w={w} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ risk heatmap ---------------------------- */

const FAILURE_MODES = ["HYD", "THRM", "VIB", "ELEC", "WEAR", "COOL"];

function RiskHeatmap({ fleet }: { fleet: MachineTelemetry[] }) {
  const slice = fleet.slice(0, 20);
  return (
    <div className="overflow-x-auto hide-scrollbar">
      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `70px repeat(${FAILURE_MODES.length}, minmax(38px, 1fr))`,
        }}
      >
        <div />
        {FAILURE_MODES.map((f) => (
          <div
            key={f}
            className="text-[9px] tracking-widest text-[#6a7690] text-center pb-1"
            style={MONO_STACK}
          >
            {f}
          </div>
        ))}
        {slice.map((m) => (
          <RiskRow key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}
function RiskRow({ m }: { m: MachineTelemetry }) {
  const seed = m.id.charCodeAt(0) + m.id.charCodeAt(m.id.length - 1);
  return (
    <>
      <div className="text-[10px] text-white/70 pr-1 self-center truncate" style={MONO_STACK}>
        {m.id}
      </div>
      {FAILURE_MODES.map((f, i) => {
        let risk = ((seed * (i + 3)) % 100) / 100;
        if (m.status === "warn") risk = Math.min(1, risk + 0.25);
        if (m.status === "down") risk = Math.min(1, risk + 0.5);
        const c =
          risk > 0.7 ? "#e5556b" : risk > 0.45 ? "#e8b464" : risk > 0.2 ? "#6ea8ff" : "#1e2636";
        return (
          <div
            key={f}
            className="h-6 rounded-sm"
            style={{
              background: `${c}${risk > 0.2 ? "" : "55"}`,
              opacity: 0.25 + risk * 0.75,
              animation: risk > 0.7 ? "maint-blink 1.6s infinite" : undefined,
            }}
            title={`${m.id} · ${f} · ${(risk * 100).toFixed(0)}%`}
          />
        );
      })}
    </>
  );
}

/* ------------------------------ spares ---------------------------------- */

function SparesPanel() {
  const spares = useMemo(() => buildSpares(), []);
  return (
    <div className="flex flex-col gap-1.5">
      {spares.map((s) => {
        const low = s.onHand < s.min;
        const zero = s.onHand === 0;
        const c = zero ? "#e5556b" : low ? "#e8b464" : "#4ecb8a";
        const pct = Math.min(100, (s.onHand / Math.max(1, s.min * 2)) * 100);
        return (
          <div
            key={s.sku}
            className="flex items-center gap-2 text-[11px]"
            style={zero ? { animation: "maint-pulse-glow 2s infinite" } : undefined}
          >
            <div className="w-14 text-[9px] text-[#6a7690] shrink-0" style={MONO_STACK}>
              {s.sku}
            </div>
            <div className="flex-1 truncate text-white/80">{s.part}</div>
            <div className="w-20 h-1.5 bg-[#0b111c] rounded-full overflow-hidden border border-[#1e2636]">
              <div className="h-full" style={{ width: `${pct}%`, background: c }} />
            </div>
            <div className="w-12 text-right tabular-nums font-bold" style={{ ...MONO_STACK, color: c }}>
              {s.onHand}/{s.min}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ PM timeline ----------------------------- */

function PmTimeline() {
  const tasks = useMemo(() => buildPm(), []);
  const days = 14;
  return (
    <div className="overflow-x-auto hide-scrollbar">
      <div className="min-w-[720px]">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${days}, 1fr)` }}>
          {Array.from({ length: days }).map((_, i) => (
            <div
              key={i}
              className="text-[9px] text-center text-[#6a7690] pb-1"
              style={MONO_STACK}
            >
              D+{i}
            </div>
          ))}
          {Array.from({ length: days }).map((_, i) => {
            const items = tasks.filter((t) => t.day === i);
            return (
              <div
                key={i}
                className="min-h-[90px] rounded border border-[#1e2636] bg-[#0b111c]/50 p-1 flex flex-col gap-1"
              >
                {items.slice(0, 3).map((t, k) => {
                  const c = t.hours > 4 ? "#e5556b" : t.hours > 2 ? "#e8b464" : "#6ea8ff";
                  return (
                    <div
                      key={k}
                      className="rounded-sm px-1 py-0.5 border text-[8px] truncate"
                      style={{
                        borderColor: `${c}55`,
                        background: `${c}12`,
                        color: "#fff",
                        ...MONO_STACK,
                      }}
                      title={`${t.machine} · ${t.task} · ${t.hours}h`}
                    >
                      <div className="font-bold truncate" style={{ color: c }}>
                        {t.machine}
                      </div>
                      <div className="truncate opacity-80">{t.task}</div>
                    </div>
                  );
                })}
                {items.length > 3 && (
                  <div className="text-[8px] text-[#6a7690] text-center" style={MONO_STACK}>
                    +{items.length - 3}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ ambient backdrop ------------------------ */

function AmbientBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.08] maint-motion"
        style={{
          backgroundImage:
            "linear-gradient(#6ea8ff 1px, transparent 1px), linear-gradient(90deg, #6ea8ff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          animation: "maint-grid-drift 20s linear infinite",
        }}
      />
      <div
        className="absolute inset-x-0 h-[2px] opacity-40 maint-motion"
        style={{
          background:
            "linear-gradient(90deg, transparent, #6ea8ff, transparent)",
          animation: "maint-scanline 7s linear infinite",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(0,229,255,0.08), transparent 60%)",
        }}
      />
    </div>
  );
}

/* ------------------------------ page ------------------------------------ */

function MaintenancePage() {
  const tick = useTick(300);
  const fleet = useMemo(() => buildFleet(tick), [tick]);
  const alerts = useMemo(() => buildAlerts(tick), [tick]);
  const wos = useMemo(() => buildWorkOrders(tick), [tick]);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white relative" style={FONT_STACK}>
      <AmbientBackdrop />
      <TopBar />
      <main className="relative z-10 mx-auto max-w-[1700px] px-6 py-6 space-y-4">
        {/* Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Panel title="FLEET HEALTH" className="lg:col-span-3" delay={0}>
            <FleetHealthGauge fleet={fleet} />
          </Panel>
          <Panel
            title="LIVE TELEMETRY"
            className="lg:col-span-6"
            delay={80}
            right={
              <span
                className="text-[9px] tracking-widest text-[#4ecb8a] flex items-center gap-1.5"
                style={MONO_STACK}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#4ecb8a]"
                  style={{ animation: "maint-blink 1.2s infinite" }}
                />
                LIVE · {fleet.length} NODES
              </span>
            }
          >
            <TelemetryWall fleet={fleet} />
          </Panel>
          <Panel
            title="CRITICAL ALERTS"
            className="lg:col-span-3"
            delay={160}
            right={
              <span
                className="text-[9px] tracking-widest text-[#e5556b]"
                style={MONO_STACK}
              >
                {alerts.filter((a) => a.severity === "crit").length} CRIT
              </span>
            }
          >
            <AlertStream alerts={alerts} />
          </Panel>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 space-y-4">
            <Panel title="OPERATIONAL METRICS" delay={220}>
              <KpiCounters fleet={fleet} />
            </Panel>
            <Panel
              title="DOWNTIME PARETO · LAST 24H"
              delay={280}
              right={
                <span className="text-[9px] tracking-widest text-[#6a7690]" style={MONO_STACK}>
                  MINUTES
                </span>
              }
            >
              <DowntimePareto tick={tick} />
            </Panel>
            <Panel title="PREDICTIVE RISK MATRIX" delay={340}>
              <RiskHeatmap fleet={fleet} />
            </Panel>
          </div>
          <div className="lg:col-span-3 space-y-4">
            <Panel
              title="WORK ORDER QUEUE"
              delay={220}
              right={
                <span className="text-[9px] tracking-widest text-[#6a7690]" style={MONO_STACK}>
                  {wos.length} TOTAL
                </span>
              }
            >
              <WorkOrderKanban wos={wos} />
            </Panel>
            <Panel title="SPARES INVENTORY" delay={340}>
              <SparesPanel />
            </Panel>
          </div>
        </div>

        {/* Row 3 */}
        <Panel
          title="PREVENTIVE MAINTENANCE · 14-DAY HORIZON"
          delay={400}
          right={
            <span className="text-[9px] tracking-widest text-[#6a7690]" style={MONO_STACK}>
              TODAY → +14D
            </span>
          }
        >
          <PmTimeline />
        </Panel>

        <footer className="pt-4 pb-8 text-center">
          <div
            className="text-[10px] tracking-[0.35em] text-[#6a7690] uppercase"
            style={MONO_STACK}
          >
            ▲ AMG MAINTENANCE OS · v2.6.1 · classified: internal
          </div>
        </footer>
      </main>
    </div>
  );
}