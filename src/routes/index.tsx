import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIntouchSnapshot, type IntouchSnapshot } from "@/hooks/use-intouch-snapshot";
import { CopilotSyncPanel } from "@/components/intouch/CopilotSyncPanel";
import { DashboardControl } from "@/components/DashboardControl";
import { useFloorOverrides, setFloorOverride } from "@/hooks/use-floor-overrides";
import {
  useDeviationMapToday,
  useDeviationsOnDate,
  useDeviationCountFor,
  useDeviationCountOnDate,
  toggleDeviation,
  clearDeviations,
  previousProductionDayKey,
  yesterdayKey,
  type PillarKey as DeviationPillarKey,
} from "@/hooks/use-deviation-map";
import {
  usePillarDayHistory,
  recordPillarDay,
  dateKey,
  type DayStatus,
} from "@/hooks/use-pillar-day-history";
import {
  useDashboardDateStatus,
  useDashboardDateStatusEditor,
  useSafetyIncidentEditor,
} from "@/hooks/use-dashboard-date-status";
import {
  REPRO_COMPLETE_EVENT,
  useDashboardDailySnapshotHistory,
  useDashboardDailySnapshotSync,
  type DashboardDailySnapshotInput,
} from "@/hooks/use-dashboard-daily-snapshot";
import { useMastercardsUploader } from "@/hooks/use-mastercards-upload";
import { useComplianceData, useComplianceUploader } from "@/hooks/use-compliance-upload";
import { useDashboardData, useMarkMasterCardCreated, type DashboardData, type DashboardPeriod, type FloorMapEntry } from "@/hooks/use-dashboard-data";
import { useMoldingScrap, type MoldingScrapData } from "@/hooks/use-molding-scrap";
import { useMastercardsProduction, type MastercardProductionRow } from "@/hooks/use-mastercards-production";
import { useDashboardTasks, type DashboardTask } from "@/hooks/use-dashboard-tasks";
import { useDashboardWeather } from "@/hooks/use-dashboard-weather";
import { useLatestDashboardCommand, type DashboardCommand } from "@/hooks/use-dashboard-control";
import { useBuyoffRejectionAlerts, type BuyoffRejectionAlert } from "@/hooks/use-buyoff-rejection-alerts";
import { usePafBuyoffs, type PafBuyoff } from "@/hooks/use-paf-buyoffs";
import { useExtrusionBuyoffs } from "@/hooks/use-extrusion-buyoffs";
import type { DeviationExcelRow } from "@/hooks/use-process-deviations";
import { useProcessDeviationList } from "@/hooks/use-process-deviation-list";
import { useProductDeviations } from "@/hooks/use-product-deviations";
import { MONTHLY_SCRAP } from "@/data/monthly-scrap";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Box,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Gauge,
  Filter,
  Shield,
  BadgeCheck,
  Quote,
  Sun,
  Truck,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
      { name: "description", content: "Live performance board: Safety, Quality, Process Deviation, Product Deviation, and Productivity." },
      { property: "og:title", content: "AMG Dashboard" },
      { property: "og:description", content: "Daily Process Management dashboard for AMG." },
    ],
  }),
  component: Index,
});

type Status = "ok" | "warn" | "fail" | "na";

type QualityIssue = {
  machine: string;
  status: "missing" | "comparable" | "no data";
  when: string;
  partNumber?: string;
};

type Pillar = {
  key: "S" | "Q" | "D" | "I" | "P";
  label: string;
  kpi: string;
  icon: typeof Shield;
};

const PILLARS: Pillar[] = [
  { key: "S", label: "Safety", kpi: "0 Equip Safety Issues", icon: Shield },
  { key: "Q", label: "Quality", kpi: "Weekly Scrap < 5%", icon: BadgeCheck },
  { key: "D", label: "Process Deviation", kpi: "≥ 3 New Process Deviations", icon: Truck },
  { key: "I", label: "Product Deviation", kpi: "0 New Product Deviations", icon: Box },
  { key: "P", label: "Productivity", kpi: "≥ 90% MasterCard availability", icon: Gauge },
];

const SHIFTS = ["LD", "MD", "SD1", "SD2", "FS", "PA&F", "EXT"] as const;

const SHIFT_ZONE_MAP: Record<(typeof SHIFTS)[number], string[]> = {
  LD: ["LD Cell"],
  MD: ["MD Cell"],
  SD1: ["SD Cell 1"],
  SD2: ["SD Cell 2"],
  FS: ["Fuseal Cell"],
  "PA&F": ["Coil & Collar"],
  EXT: ["ENG. Extrusion", "Vinyls Extrusion"],
};


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
      { label: "Weekly scrap", value: "—" },
      { label: "Cell yield", value: "—" },
      { label: "Cell scrap", value: "—" },
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
    issues: ["Missing MasterCard", "Comparable MasterCard requires review", "MasterCard not available at machine"],
    actions: [
      { task: "SMED kaizen press 6", owner: "CI team", due: "Next wk" },
      { task: "Tune sensor on conveyor 3", owner: "Maint.", due: "Thu" },
    ],
    shiftNotes: { LD: "MasterCard check", MD: "MasterCard check", SD1: "MasterCard check", SD2: "MasterCard check", FS: "MasterCard check", "PA&F": "MasterCard check", EXT: "MasterCard check" },
    stats: [
      { label: "MasterCard availability", value: "—" },
      { label: "Buy Off jobs", value: "—" },
      { label: "Missing MasterCards", value: "—" },
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

/**
 * Build a pillar's month-of-dots from real recorded history only.
 * - Weekends and future days are always "na" (no shift, nothing to report).
 * - Today uses the live-computed status when available (and that same value
 *   is what gets persisted into history — see the recordPillarDay calls in
 *   Index()), falling back to whatever was last recorded for today.
 * - Every earlier weekday reads straight from history; if the app has no
 *   recorded status for that day, the dot is "na" — no fabricated data.
 */
function buildMonthDotsFromHistory(
  displayedMonth: Date,
  history: Record<string, DayStatus>,
  now: Date,
  liveToday: DayStatus | null,
) {
  const displayedYear = displayedMonth.getFullYear();
  const displayedMonthIndex = displayedMonth.getMonth();
  const daysInMonth = new Date(displayedYear, displayedMonthIndex + 1, 0).getDate();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dots: { day: number; status: Status; weekend: boolean }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const thisDate = new Date(displayedYear, displayedMonthIndex, d);
    const dow = thisDate.getDay();
    const weekend = dow === 0 || dow === 6;
    if (weekend) {
      dots.push({ day: d, status: "na", weekend: true });
      continue;
    }
    if (thisDate.getTime() > todayStart) {
      dots.push({ day: d, status: "na", weekend: false });
      continue;
    }
    const key = dateKey(thisDate);
    const isToday = thisDate.getTime() === todayStart;
    const status: Status = (isToday && liveToday) || history[key] || "na";
    dots.push({ day: d, status, weekend: false });
  }
  return dots;
}

/** Quality: scrap-rate tiers, matching the thresholds used by scrapTone() elsewhere. */
function scrapStatus(rate: number): DayStatus {
  if (rate < 0.04) return "ok";
  if (rate <= 0.05) return "warn";
  return "fail";
}

/** Delivery: 0 deviations today is fine, 1-3 is a warning, >3 is a miss. */
function deliveryStatus(deviationsToday: number): DayStatus {
  if (deviationsToday > 3) return "fail";
  if (deviationsToday >= 1) return "warn";
  return "ok";
}

/** Inventory: any product deviation today is a miss — no partial credit. */
function inventoryStatus(deviationsToday: number): DayStatus {
  return deviationsToday >= 1 ? "fail" : "ok";
}

/**
 * Productivity: no direct downtime metric is exposed by the dashboard API,
 * so MasterCard availability (machines running with a valid MasterCard) is
 * used as the closest live proxy for "the floor is running well today."
 */
function productivityStatus(mcAvailablePercent: number): DayStatus {
  return mcAvailablePercent >= 90 ? "ok" : "fail";
}

/**
 * Map a Delivery/Inventory deviation map to per-shift statuses.
 * A shift is red if any machine in its mapped floor zone is flagged
 * (regardless of which day the flag was set — the floor map shows
 * unresolved deviations, not just today's).
 */
function computeDeviationShiftStatuses(
  deviations: Record<string, string>,
): Status[] {
  return SHIFTS.map((shift) => {
    const zones = SHIFT_ZONE_MAP[shift];
    const machines = zones.flatMap(
      (z) => FLOOR_LAYOUT.find((f) => f.zone === z)?.machines ?? [],
    );
    const hasDeviation = machines.some((m) => deviations[m]);
    return hasDeviation ? "fail" : "ok";
  });
}

function shiftMachineId(value: string): string {
  const normalized = value.toUpperCase().replace(/\s+/g, "").trim();
  const typedId = normalized.match(/^(.*?)(?:IM|EM|AM)\d*$/);
  return (typedId?.[1] ?? normalized).replace(/^0+/, "");
}

/** A Productivity shift fails when any running machine in that shift has no usable MasterCard. */
function computeMasterCardShiftStatuses(data: DashboardData | null): Status[] {
  const jobs = data?.machineJobs ?? [];
  return SHIFTS.map((shift) => {
    const shiftMachines = new Set(
      SHIFT_ZONE_MAP[shift]
        .flatMap((zone) => FLOOR_LAYOUT.find((entry) => entry.zone === zone)?.machines ?? [])
        .map(shiftMachineId),
    );
    const hasMissingMasterCard = jobs.some((job) => {
      if (!shiftMachines.has(shiftMachineId(job.machine))) return false;
      const masterCard = (job.masterCard || "").trim().toLowerCase();
      return masterCard !== "yes" && !masterCard.startsWith("compar");
    });
    return hasMissingMasterCard ? "fail" : "ok";
  });
}

function useQualityIssues(data: DashboardData | null): QualityIssue[] {
  return useMemo(() => {
    if (!data?.floorMap) return [];
    const entries: FloorMapEntry[] = Array.isArray(data.floorMap)
      ? data.floorMap
      : Object.values(data.floorMap);
    const issues: QualityIssue[] = [];
    for (const e of entries) {
      const rawStatus = (e.status ?? e.worstStatus ?? "").toString().toLowerCase().trim();
      if (!rawStatus || rawStatus.startsWith("match")) continue;
      const issueStatus: QualityIssue["status"] =
        rawStatus.startsWith("miss") ? "missing" : rawStatus === "comparable" ? "comparable" : "no data";
      const latest = e.jobs
        .filter((j) => j.dateCreated)
        .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())[0];
      issues.push({
        machine: e.machine,
        status: issueStatus,
        when: latest?.dateCreated ?? data.latestDate ?? "—",
        partNumber: latest?.partNumber,
      });
    }
    return issues.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
  }, [data]);
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
  const [quote, setQuote] = useState(() => {
    const today = new Date();
    const idx = dateSeed(today, 42) % DAILY_QUOTES.length;
    return DAILY_QUOTES[idx];
  });

  useEffect(() => {
    const selectQuote = async () => {
      const today = new Date();
      const quoteDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const storageKey = "amg-daily-quote:wikiquote:v2";
      if (quoteDate === "2026-07-23") {
        setQuote({ text: "Quality is everyone's responsibility.", author: "W. Edwards Deming" });
        return;
      }
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (stored?.dateKey === quoteDate && stored?.quote?.text && stored?.quote?.author) {
          setQuote(stored.quote);
          return;
        }
      } catch {
        /* noop */
      }

      try {
        const response = await fetch(`https://wq-quote-of-the-day-parser.toolforge.org/api/quotes/${quoteDate}`);
        if (!response.ok) throw new Error(`Quote service returned ${response.status}`);
        const payload = await response.json() as { quote?: unknown; author?: unknown };
        const text = String(payload.quote ?? "").trim();
        const author = String(payload.author ?? "").trim();
        if (!text || !author) throw new Error("Quote service returned an incomplete quote");
        const selected = { text, author };
        setQuote(selected);
        localStorage.setItem(storageKey, JSON.stringify({ dateKey: quoteDate, quote: selected }));
      } catch {
        const idx = dateSeed(today, 42) % DAILY_QUOTES.length;
        setQuote(DAILY_QUOTES[idx]);
      }
    };

    void selectQuote();
    const id = setInterval(() => void selectQuote(), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return quote;
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

type Holiday = { name: string; date: Date };

function nthWeekday(year: number, month: number, weekday: number, occurrence: number): Date {
  const date = new Date(year, month, 1);
  date.setDate(1 + ((7 + weekday - date.getDay()) % 7) + (occurrence - 1) * 7);
  return date;
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const date = new Date(year, month + 1, 0);
  date.setDate(date.getDate() - ((7 + date.getDay() - weekday) % 7));
  return date;
}

function observed(date: Date): Date {
  const result = new Date(date);
  if (result.getDay() === 6) result.setDate(result.getDate() - 1);
  if (result.getDay() === 0) result.setDate(result.getDate() + 1);
  return result;
}

function usHolidays(year: number): Holiday[] {
  return [
    { name: "New Year's Day", date: observed(new Date(year, 0, 1)) },
    { name: "Martin Luther King Jr. Day", date: nthWeekday(year, 0, 1, 3) },
    { name: "Presidents Day", date: nthWeekday(year, 1, 1, 3) },
    { name: "Memorial Day", date: lastWeekday(year, 4, 1) },
    { name: "Juneteenth", date: observed(new Date(year, 5, 19)) },
    { name: "Independence Day", date: observed(new Date(year, 6, 4)) },
    { name: "Labor Day", date: nthWeekday(year, 8, 1, 1) },
    { name: "Columbus Day", date: nthWeekday(year, 9, 1, 2) },
    { name: "Veterans Day", date: observed(new Date(year, 10, 11)) },
    { name: "Thanksgiving", date: nthWeekday(year, 10, 4, 4) },
    { name: "Christmas Day", date: observed(new Date(year, 11, 25)) },
  ];
}

export function Index() {
  const [phoneView, setPhoneView] = useState<"control" | "dashboard">("control");
  const [iceCreamFriday, setIceCreamFriday] = useState(false);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [trendsFocus, setTrendsFocus] = useState<Pillar["key"] | null>(null);
  const liveNow = useNow();
  const now = liveNow ?? new Date(0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const holidays = [...usHolidays(now.getFullYear()), ...usHolidays(now.getFullYear() + 1)]
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const todayHoliday = holidays.find((holiday) => holiday.date.getTime() === today.getTime());
  const nextHoliday = holidays.find((holiday) => holiday.date.getTime() >= today.getTime());
  const { command: remoteCommand, acknowledge: acknowledgeRemoteCommand } = useLatestDashboardCommand();
  const quote = useDailyQuote();
  const deliveryDeviations = useDeviationMapToday("D");
  const inventoryDeviations = useDeviationMapToday("I");
  const todayKey = liveNow ? dateKey(liveNow) : "";
  const deliveryDeviationsToday = useDeviationCountOnDate("D", todayKey);
  const inventoryDeviationsToday = useDeviationCountOnDate("I", todayKey);

  useEffect(() => {
    if (!remoteCommand) return;
    const timer = window.setTimeout(() => {
      void acknowledgeRemoteCommand(remoteCommand.id);
    }, 1_500);
    return () => window.clearTimeout(timer);
  }, [remoteCommand, acknowledgeRemoteCommand]);

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

  const dateStr = liveNow ? liveNow.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" }) : "";
  const timeStr = liveNow ? liveNow.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--";

  // Per-pillar shift status (deterministic per day)
  const shiftStatuses = PILLARS.map((_, i) => {
    const rng = mulberry32(dateSeed(now, 1000 + i));
    return SHIFTS.map(() => pickStatus(rng));
  });

  const { data: dashboardData } = useDashboardData();
  const processDeviationQuery = useProcessDeviationList();
  const processDeviationData = processDeviationQuery.data ?? { processParts: [], processMachines: [], productParts: [], rows: [] };
  const productDeviationQuery = useProductDeviations();
  const productDeviationData = productDeviationQuery.data ?? { productParts: [], rows: [] };
  const { data: moldingScrapData } = useMoldingScrap();
  const {
    data: buyoffAlerts = [],
    error: buyoffAlertError,
    isLoading: buyoffAlertLoading,
    isSuccess: buyoffAlertSuccess,
  } = useBuyoffRejectionAlerts();
  const {
    tasks: snapshotTasks,
    isLoading: snapshotTasksLoading,
    error: snapshotTasksError,
  } = useDashboardTasks();
  const snapshotReproStorageKey = dashboardData
    ? `amg.reproComplete:${dashboardData.productionWindowStart}`
    : "";
  const [snapshotReproCompleted, setSnapshotReproCompleted] = useState(0);
  useEffect(() => {
    const read = () => {
      const raw = snapshotReproStorageKey
        ? window.localStorage.getItem(snapshotReproStorageKey)
        : null;
      setSnapshotReproCompleted(Math.max(0, Number.parseInt(raw ?? "", 10) || 0));
    };
    read();
    const onReproChange = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; value?: string }>).detail;
      if (detail?.key === snapshotReproStorageKey) read();
    };
    window.addEventListener(REPRO_COMPLETE_EVENT, onReproChange);
    return () => window.removeEventListener(REPRO_COMPLETE_EVENT, onReproChange);
  }, [snapshotReproStorageKey]);
  const qualityIssues = useQualityIssues(dashboardData);
  const localSafetyHistory = usePillarDayHistory("S");

  // Real per-day pillar history: today's status is derived from live data
  // (or, for Safety, a genuine manual entry) and persisted so it becomes
  // real history from here on — see use-pillar-day-history.ts.
  const qLiveToday: DayStatus | null = moldingScrapData
    ? scrapStatus(moldingScrapData.cellTotal.scrapRate)
    : null;
  const deviationReportingDate =
    dashboardData?.productionDate?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? yesterdayKey();
  const reportingProcessRows = processDeviationData.rows.filter(
    (row) =>
      row.kind === "process" &&
      !!row.machine &&
      row.dateRequested === deviationReportingDate,
  );
  const automaticProcessDeviations: Record<string, string> = {};
  for (const row of reportingProcessRows) {
    if (row.machine) {
      const floorMachine = FLOOR_LAYOUT
        .flatMap((zone) => zone.machines)
        .find((machine) => shiftMachineId(machine) === shiftMachineId(row.machine));
      automaticProcessDeviations[floorMachine ?? row.machine] = deviationReportingDate;
      continue;
    }
    for (const job of dashboardData?.machineJobs ?? []) {
      const part = job.partNumber.toUpperCase().replace(/\s+/g, "");
      if (part !== row.part) continue;
      const floorMachine = FLOOR_LAYOUT
        .flatMap((zone) => zone.machines)
        .find((machine) => shiftMachineId(machine) === shiftMachineId(job.machine));
      automaticProcessDeviations[floorMachine ?? job.machine] = deviationReportingDate;
    }
  }
  const effectiveDeliveryDeviations = automaticProcessDeviations;
  const activeProcessDeviationCount = reportingProcessRows.length;
  const automaticProcessMachinesToday = new Set<string>();
  for (const row of processDeviationData.rows) {
    if (row.kind !== "process" || row.closed || row.dateRequested !== todayKey) continue;
    if (row.machine) {
      const floorMachine = FLOOR_LAYOUT
        .flatMap((zone) => zone.machines)
        .find((machine) => shiftMachineId(machine) === shiftMachineId(row.machine));
      automaticProcessMachinesToday.add(floorMachine ?? row.machine);
    }
  }
  const effectiveDeliveryDeviationsToday =
    processDeviationData.rows.filter(
      (row) =>
        row.kind === "process" &&
        !row.closed &&
        !!row.machine &&
        row.dateRequested === todayKey,
    ).length +
    Object.entries(deliveryDeviations).filter(
      ([machine, date]) => date === todayKey && !automaticProcessMachinesToday.has(machine),
    ).length;
  const deliveryDeviationMapToday: Record<string, string> = {
    ...Object.fromEntries(
      [...automaticProcessMachinesToday].map((machine) => [machine, todayKey]),
    ),
    ...Object.fromEntries(
      Object.entries(deliveryDeviations).filter(([, date]) => date === todayKey),
    ),
  };
  const reportingProductRows = productDeviationData.rows.filter(
    (row) => !row.closed && row.dateRequested === deviationReportingDate,
  );
  const automaticProductDeviations: Record<string, string> = {};
  for (const row of reportingProductRows) {
    if (row.machine) {
      const floorMachine = FLOOR_LAYOUT
        .flatMap((zone) => zone.machines)
        .find((machine) => shiftMachineId(machine) === shiftMachineId(row.machine));
      automaticProductDeviations[floorMachine ?? row.machine] = deviationReportingDate;
      continue;
    }
    for (const job of dashboardData?.machineJobs ?? []) {
      const part = job.partNumber.toUpperCase().replace(/\s+/g, "");
      if (part !== row.part) continue;
      const floorMachine = FLOOR_LAYOUT
        .flatMap((zone) => zone.machines)
        .find((machine) => shiftMachineId(machine) === shiftMachineId(job.machine));
      automaticProductDeviations[floorMachine ?? job.machine] = deviationReportingDate;
    }
  }
  const effectiveInventoryDeviations = automaticProductDeviations;
  const activeProductDeviationCount = reportingProductRows.length;
  const automaticProductMachinesToday = new Set<string>();
  for (const row of productDeviationData.rows) {
    if (row.closed || row.dateRequested !== todayKey) continue;
    if (row.machine) {
      const floorMachine = FLOOR_LAYOUT
        .flatMap((zone) => zone.machines)
        .find((machine) => shiftMachineId(machine) === shiftMachineId(row.machine));
      automaticProductMachinesToday.add(floorMachine ?? row.machine);
      continue;
    }
    for (const job of dashboardData?.machineJobs ?? []) {
      const part = job.partNumber.toUpperCase().replace(/\s+/g, "");
      if (part !== row.part) continue;
      const floorMachine = FLOOR_LAYOUT
        .flatMap((zone) => zone.machines)
        .find((machine) => shiftMachineId(machine) === shiftMachineId(job.machine));
      automaticProductMachinesToday.add(floorMachine ?? job.machine);
    }
  }
  const effectiveInventoryDeviationsToday =
    productDeviationData.rows.filter(
      (row) => !row.closed && row.dateRequested === todayKey,
    ).length +
    Object.entries(inventoryDeviations).filter(
      ([machine, date]) => date === todayKey && !automaticProductMachinesToday.has(machine),
    ).length;
  const inventoryDeviationMapToday: Record<string, string> = {
    ...Object.fromEntries(
      [...automaticProductMachinesToday].map((machine) => [machine, todayKey]),
    ),
    ...Object.fromEntries(
      Object.entries(inventoryDeviations).filter(([, date]) => date === todayKey),
    ),
  };
  const processAffectedAreaCount = computeDeviationShiftStatuses(
    effectiveDeliveryDeviationsToday > 0
      ? deliveryDeviationMapToday
      : effectiveDeliveryDeviations,
  ).filter((status) => status === "fail").length;
  const productAffectedAreaCount = computeDeviationShiftStatuses(
    effectiveInventoryDeviationsToday > 0
      ? inventoryDeviationMapToday
      : effectiveInventoryDeviations,
  ).filter((status) => status === "fail").length;
  const dLiveToday: DayStatus = deliveryStatus(effectiveDeliveryDeviationsToday);
  const iLiveToday: DayStatus = inventoryStatus(effectiveInventoryDeviationsToday);
  const pLiveToday: DayStatus | null = dashboardData
    ? productivityStatus(dashboardData.mcAvailablePercent ?? 0)
    : null;
  const sLiveToday = todayKey ? localSafetyHistory[todayKey] ?? null : null;
  const dateStatusHistories = useDashboardDateStatus(todayKey, {
    S: sLiveToday,
    Q: qLiveToday,
    D: dLiveToday,
    I: iLiveToday,
    P: pLiveToday,
  });
  const {
    setStatus: setDashboardDateStatus,
    isSaving: isSavingDateStatus,
    error: dateStatusSaveError,
  } = useDashboardDateStatusEditor();
  const {
    history: safetyIncidentHistory,
    setIncidents: setSafetyIncidents,
    isSaving: isSavingSafetyIncidents,
    error: safetyIncidentError,
  } = useSafetyIncidentEditor();
  const { byDate: dailySnapshots } = useDashboardDailySnapshotHistory();
  const sHistory = dateStatusHistories.S;
  const qHistory = dateStatusHistories.Q;
  const dHistory = dateStatusHistories.D;
  const iHistory = dateStatusHistories.I;
  const pHistory = dateStatusHistories.P;
  const dailyMetricHistories = useMemo(() => {
    const values: Record<Pillar["key"], Record<string, number>> = {
      S: { ...safetyIncidentHistory },
      Q: {},
      D: {},
      I: {},
      P: {},
    };
    for (const [day, snapshot] of Object.entries(dailySnapshots)) {
      if (snapshot.WeelyScrapPercent != null) values.Q[day] = snapshot.WeelyScrapPercent;
      if (snapshot.ProcessDeviationCount != null) values.D[day] = snapshot.ProcessDeviationCount;
      if (snapshot.ProductDeviationCount != null) values.I[day] = snapshot.ProductDeviationCount;
      if (snapshot.MasterCardAvailabilityPercent != null) values.P[day] = snapshot.MasterCardAvailabilityPercent;
    }
    return values;
  }, [dailySnapshots, safetyIncidentHistory]);
  const liveDailyMetrics: Record<Pillar["key"], number | null> = {
    S: safetyIncidentHistory[todayKey] ?? 0,
    Q: moldingScrapData ? moldingScrapData.cellTotal.scrapRate * 100 : null,
    D: effectiveDeliveryDeviationsToday,
    I: effectiveInventoryDeviationsToday,
    P: dashboardData?.mcAvailablePercent ?? null,
  };

  useEffect(() => {
    if (!todayKey || !qLiveToday) return;
    recordPillarDay("Q", todayKey, qLiveToday);
  }, [todayKey, qLiveToday]);
  useEffect(() => {
    if (!todayKey) return;
    recordPillarDay("D", todayKey, dLiveToday);
  }, [todayKey, dLiveToday]);
  useEffect(() => {
    if (!todayKey) return;
    recordPillarDay("I", todayKey, iLiveToday);
  }, [todayKey, iLiveToday]);
  useEffect(() => {
    if (!todayKey || !pLiveToday) return;
    recordPillarDay("P", todayKey, pLiveToday);
  }, [todayKey, pLiveToday]);

  // Backfill Productivity's real history from actual dated job records —
  // the dashboard API returns every Machine+Part job with a real
  // dateCreated for whatever window it currently serves (one production
  // day most days, the full previous week on Mondays). Group those by day
  // and record each day's real MC-availability rate. This is the only
  // pillar with genuine per-day historical data anywhere in the app today;
  // Safety/Delivery/Inventory/Quality have no equivalent source, so their
  // history can only start accumulating from today forward.
  useEffect(() => {
    const jobs = dashboardData?.machineJobs;
    if (!jobs?.length) return;
    const byDay = new Map<string, { total: number; available: number }>();
    for (const j of jobs) {
      const day = j.dateCreated;
      if (!day) continue;
      const bucket = byDay.get(day) ?? { total: 0, available: 0 };
      bucket.total += 1;
      const mc = (j.masterCard || "").toLowerCase();
      if (mc === "yes" || mc.startsWith("compar")) bucket.available += 1;
      byDay.set(day, bucket);
    }
    for (const [day, { total, available }] of byDay) {
      const pct = total === 0 ? 0 : Math.round((available / total) * 100);
      recordPillarDay("P", day, productivityStatus(pct));
    }
  }, [dashboardData?.machineJobs]);

  const snapshotProcessAffectedAreas = computeDeviationShiftStatuses(
    effectiveDeliveryDeviations,
  ).filter((status) => status === "fail").length;
  const snapshotProductAffectedAreas = computeDeviationShiftStatuses(
    effectiveInventoryDeviations,
  ).filter((status) => status === "fail").length;
  const openEscalationCount = snapshotTasks.filter(
    (task) => task.taskType === "Escalation" && task.status !== "Complete",
  ).length;
  const longTermActionCount = snapshotTasks.filter(
    (task) => task.taskType === "LongTermAction" && task.status !== "Complete",
  ).length;
  const snapshotInput: DashboardDailySnapshotInput | null = dashboardData
    ? {
        productionDate: dashboardData.productionDate,
        safetyStatus:
          sHistory[dashboardData.productionDate] ??
          (dashboardData.productionDate === todayKey ? sLiveToday : null),
        qualityStatus: qLiveToday,
        processDeviationStatus: processDeviationQuery.isSuccess
          ? deliveryStatus(activeProcessDeviationCount)
          : null,
        productDeviationStatus: productDeviationQuery.isSuccess
          ? inventoryStatus(activeProductDeviationCount)
          : null,
        productivityStatus: productivityStatus(dashboardData.mcAvailablePercent),
        weeklyScrapPercent: moldingScrapData
          ? moldingScrapData.cellTotal.scrapRate * 100
          : null,
        processDeviationCount: processDeviationQuery.isSuccess
          ? activeProcessDeviationCount
          : null,
        processAffectedAreas: processDeviationQuery.isSuccess
          ? snapshotProcessAffectedAreas
          : null,
        productDeviationCount: productDeviationQuery.isSuccess
          ? activeProductDeviationCount
          : null,
        productAffectedAreas: productDeviationQuery.isSuccess
          ? snapshotProductAffectedAreas
          : null,
        buyoffCount: dashboardData.buyOffCount,
        masterCardAvailable: dashboardData.mcAvailableCount,
        masterCardTotal: dashboardData.buyOffCount,
        masterCardAvailabilityPercent: dashboardData.mcAvailablePercent,
        reproCompleted: snapshotReproCompleted,
        reproPercent: dashboardData.buyOffCount
          ? (snapshotReproCompleted / dashboardData.buyOffCount) * 100
          : 0,
        repeatedRejectionCount: buyoffAlertSuccess ? buyoffAlerts.length : null,
        openEscalationCount:
          !snapshotTasksLoading && !snapshotTasksError ? openEscalationCount : null,
        longTermActionCount:
          !snapshotTasksLoading && !snapshotTasksError ? longTermActionCount : null,
      }
    : null;
  const { error: dailySnapshotError } = useDashboardDailySnapshotSync(snapshotInput);

  const isPhoneController = window.matchMedia("(max-width: 700px)").matches;
  if ((isPhoneController && phoneView === "control") || (!isPhoneController && new URLSearchParams(window.location.search).get("control") === "1")) {
    return <DashboardControl onViewDashboard={isPhoneController ? () => setPhoneView("dashboard") : undefined} />;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {isPhoneController && (
        <button type="button" onClick={() => setPhoneView("control")} className="fixed bottom-4 right-4 z-[70] rounded-full bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground shadow-xl">
          Remote Control
        </button>
      )}

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
      <div className="fixed bottom-4 right-4 z-50 flex gap-2 hidden">
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

      <header className="sticky top-0 z-20 border-b border-[#315b91] bg-[#073778] text-white shadow-md">
        <div className="w-full px-3 sm:px-4 lg:px-5 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="h-9 px-2.5 rounded-sm border border-white/25 bg-white grid place-items-center font-black tracking-tight shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
              aria-label="Georg Fischer"
            >
              <span className="text-base leading-none font-mono text-[#0033a0]">+GF+</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none text-white">AMG Daily Process Management</h1>
              <p className="text-xs text-white/65 mt-1">Engineering Cell · Operations</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {iceCreamFriday && (
              <div className="hidden items-center gap-2 rounded-sm border border-[#d7b45b] bg-[#fff8df] px-3 py-1.5 text-xs font-semibold text-[#72520a] lg:flex">
                <span aria-hidden>🍦</span>
                Ice Cream Friday
              </div>
            )}
            {nextHoliday && (
              <div
                className="hidden rounded-sm border border-white/20 bg-white/10 px-2.5 py-1.5 text-[10px] leading-tight text-white/80 xl:block"
                title={holidays
                  .filter((holiday) => holiday.date.getFullYear() === now.getFullYear())
                  .map((holiday) => `${holiday.name}: ${holiday.date.toLocaleDateString("en-US")}`)
                  .join("\n")}
              >
                <span className="block uppercase tracking-wider text-white/50">
                  {todayHoliday ? "Holiday today" : "Next holiday"}
                </span>
                <span className="font-semibold text-white">
                  {(todayHoliday ?? nextHoliday).name} · {(todayHoliday ?? nextHoliday).date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            )}
            <div className="hidden max-w-[520px] items-center gap-3 border-x border-white/20 px-5 md:flex">
              <Quote className="size-5 shrink-0 text-[#9ec5ff]" />
              <div className="min-w-0 leading-tight">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/50">
                  Quote of the Day
                </div>
                <blockquote className="mt-0.5 line-clamp-1 text-xs italic text-white" title={quote.text}>
                  “{quote.text}”
                </blockquote>
                <div className="mt-0.5 truncate text-[10px] text-white/60">— {quote.author}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setTrendsFocus(null);
                setTrendsOpen(true);
              }}
              title="Monthly and yearly trends across all pillars"
              className="flex items-center gap-1.5 rounded-sm border border-white/25 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <BarChart3 className="size-4" />
              <span className="hidden sm:inline">Trends</span>
            </button>

            <WeatherBadge />

            <button
              type="button"
              onClick={() => setIceCreamFriday((enabled) => !enabled)}
              aria-pressed={iceCreamFriday}
              title="Click to show or hide the Ice Cream Friday announcement"
              className="rounded-sm px-1.5 py-1 text-right transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <div className="font-mono text-xl font-semibold tabular-nums tracking-tight" suppressHydrationWarning>{timeStr}</div>
              <div className="text-xs text-white/65" suppressHydrationWarning>{dateStr}</div>
            </button>
          </div>
        </div>
      </header>

      {trendsOpen && (
        <TrendsModal
          focusPillar={trendsFocus}
          onClose={() => setTrendsOpen(false)}
          onUnfocus={() => setTrendsFocus(null)}
          processDeviationRows={processDeviationData.rows}
          productDeviationRows={productDeviationData.rows}
        />
      )}

      <main className="w-full space-y-3 px-3 py-3 sm:px-4 lg:px-5">
        {/* QDIP grid */}
        <section>
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PILLARS.map((p, i) => (
            <PillarCard
              key={p.key}
              pillar={p}
              history={{ S: sHistory, Q: qHistory, D: dHistory, I: iHistory, P: pHistory }[p.key]}
              liveToday={{ S: sLiveToday, Q: qLiveToday, D: dLiveToday, I: iLiveToday, P: pLiveToday }[p.key]}
              now={now}
              metricHistory={dailyMetricHistories[p.key]}
              liveMetric={liveDailyMetrics[p.key]}
              shifts={
                p.key === "D"
                  ? computeDeviationShiftStatuses(effectiveDeliveryDeviations)
                  : p.key === "I"
                    ? computeDeviationShiftStatuses(effectiveInventoryDeviations)
                    : p.key === "P"
                      ? computeMasterCardShiftStatuses(dashboardData)
                      : shiftStatuses[i]
              }

              qualityIssues={p.key === "Q" ? qualityIssues : undefined}
              qualityScrap={p.key === "Q" ? moldingScrapData : undefined}
              dashboardData={p.key === "P" ? dashboardData : undefined}
              activeDeviationCount={p.key === "D" ? activeProcessDeviationCount : p.key === "I" ? activeProductDeviationCount : undefined}
              todayDeviationCount={p.key === "D" ? effectiveDeliveryDeviationsToday : p.key === "I" ? effectiveInventoryDeviationsToday : undefined}
              affectedAreaCount={p.key === "D" ? processAffectedAreaCount : p.key === "I" ? productAffectedAreaCount : undefined}
              remoteCommand={remoteCommand}
              buyoffAlerts={p.key === "P" ? buyoffAlerts : undefined}
              buyoffAlertError={p.key === "P" ? buyoffAlertError : undefined}
              buyoffAlertLoading={p.key === "P" ? buyoffAlertLoading : undefined}
              onDateStatusChange={(day, status) =>
                setDashboardDateStatus({ pillar: p.key, day, status })
              }
              onSafetyIncidentsChange={p.key === "S"
                ? (count) => setSafetyIncidents({ day: todayKey, count })
                : undefined}
              isSavingSafetyIncidents={p.key === "S" && isSavingSafetyIncidents}
              isSavingDateStatus={isSavingDateStatus}
              onOpenTrends={() => {
                setTrendsFocus(p.key);
                setTrendsOpen(true);
              }}
              index={i}
            />
          ))}
          </div>
          {dateStatusSaveError && (
            <p className="mt-2 text-xs text-danger">
              Could not save the date status to SharePoint:{" "}
              {dateStatusSaveError instanceof Error ? dateStatusSaveError.message : "Unknown error"}
            </p>
          )}
          {safetyIncidentError && (
            <p className="mt-2 text-xs text-danger">
              Could not save the Safety incident count: {safetyIncidentError.message}
            </p>
          )}
          {dailySnapshotError && (
            <p className="mt-2 text-xs text-danger">
              Could not save the Dashboard Daily Snapshot: {dailySnapshotError.message}
            </p>
          )}
        </section>

        {/* Footer notes */}
        <section>
          <div className="mb-3 border-l-4 border-primary pl-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">Actions and follow-up</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <FollowUpTasksCard title="Open Escalations" taskType="Escalation" />
          <FollowUpTasksCard title="Long-Term Actions" taskType="LongTermAction" />
          </div>
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
  return (
    <div className="relative min-h-[76px] p-3">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-primary">{value}</div>
          {sub && <div className="mt-1 truncate text-xs text-muted-foreground" title={sub}>{sub}</div>}
        </div>
        <span className="ml-4 grid size-9 shrink-0 place-items-center rounded-sm bg-primary text-primary-foreground">
          <Icon className={`size-4 ${tone === "warn" ? "text-[#ffe08a]" : tone === "fail" ? "text-white" : "text-primary-foreground"}`} />
        </span>
      </div>
    </div>
  );
}

function BuyoffAlertMonitor({
  alerts,
  error,
  isLoading,
  expanded = false,
}: {
  alerts: BuyoffRejectionAlert[];
  error: Error | null;
  isLoading: boolean;
  expanded?: boolean;
}) {
  const [hiddenKeys, setHiddenKeys] = useLocalState<string[]>(
    "amg:hidden-buyoff-rejection-alerts",
    [],
  );
  const visibleAlerts = alerts.filter((alert) => !hiddenKeys.includes(alert.key));
  const hiddenCurrentCount = alerts.length - visibleAlerts.length;
  const dismissAlert = (key: string) =>
    setHiddenKeys((current) => current.includes(key) ? current : [...current, key]);
  const restoreAlerts = () =>
    setHiddenKeys((current) => current.filter((key) => !alerts.some((alert) => alert.key === key)));

  return (
    <div
      className={`rounded-sm border-l-4 px-2.5 py-2 text-[10px] ${
        visibleAlerts.length
          ? "border-danger bg-danger/10"
          : error
            ? "border-warning bg-warning/10"
            : "border-success bg-success/10"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        {visibleAlerts.length || error ? (
          <AlertTriangle className={`mt-0.5 size-3.5 shrink-0 ${visibleAlerts.length ? "text-danger" : "text-warning"}`} />
        ) : (
          <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold uppercase tracking-wide">
            {visibleAlerts.length
              ? `${visibleAlerts.length} repeated buyoff rejection alert${visibleAlerts.length === 1 ? "" : "s"}`
              : error
                ? "Alert monitor unavailable"
                : "Alert monitor active"}
            </div>
            {hiddenCurrentCount > 0 && (
              <button
                type="button"
                onClick={restoreAlerts}
                className="rounded-sm border border-border bg-card px-2 py-1 text-[9px] font-semibold normal-case tracking-normal text-primary hover:bg-secondary"
              >
                Restore hidden ({hiddenCurrentCount})
              </button>
            )}
          </div>
          {visibleAlerts.length ? (
            <ul
              className={`hide-scrollbar mt-2 overflow-y-auto ${
                expanded ? "max-h-[420px] space-y-2" : "max-h-[130px] space-y-1.5"
              }`}
            >
              {visibleAlerts.map((alert) => (
                <li
                  key={alert.key}
                  className={`rounded-md border border-danger/25 bg-card/70 ${expanded ? "p-3" : "p-2"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className={`font-bold ${expanded ? "text-sm" : "text-xs"}`}>
                          Machine {alert.machine}
                        </span>
                        <span className="text-muted-foreground">Part {alert.partNumber}</span>
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        Latest: {new Date(alert.latestRejection).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="whitespace-nowrap rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
                        {alert.rejectionCount} rejects / 24h
                      </span>
                      <button
                        type="button"
                        onClick={() => dismissAlert(alert.key)}
                        className="grid size-5 shrink-0 place-items-center rounded-sm border border-border bg-card text-muted-foreground hover:border-danger/50 hover:text-danger"
                        aria-label={`Hide alert for machine ${alert.machine}, part ${alert.partNumber}`}
                        title="Hide on this dashboard only"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-0.5 text-muted-foreground">
              {error
                ? error.message
                : isLoading
                  ? "Checking the last 24 hours…"
                  : hiddenCurrentCount
                    ? "All current alerts are hidden on this dashboard. Backend records were not changed."
                    : "No repeated rejections in the last 24 hours."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AvailabilityScrapChart() {
  return <AvailabilityScrapChartImpl />;
}

function LiveDashboardSection({ period = "production-day" }: { period?: DashboardPeriod }) {
  const { data, isLoading, error, lastFetchedAt } = useDashboardData(period);
  const [reproValues, setReproValues] = useState<Record<string, string>>({});
  const reproStorageKey = data
    ? `amg.reproComplete:${data.productionWindowStart}`
    : "";
  const reproComplete = reproStorageKey
    ? reproValues[reproStorageKey] ?? window.localStorage.getItem(reproStorageKey) ?? ""
    : "";
  const setReproComplete = (value: string) => {
    if (!reproStorageKey) return;
    window.localStorage.setItem(reproStorageKey, value);
    setReproValues((current) => ({ ...current, [reproStorageKey]: value }));
    window.dispatchEvent(
      new CustomEvent(REPRO_COMPLETE_EVENT, {
        detail: { key: reproStorageKey, value },
      }),
    );
  };
  return (
    <section className="space-y-4">
      {error && (
        <div className="rounded-sm border border-danger/50 bg-danger/10 text-danger px-4 py-3 text-sm">
          Cannot load {period !== "production-day" ? "monthly" : "production-day"} Productivity data ({error}). Make sure the SharePoint connection or local backend is available at{" "}
          <code className="font-mono">{(import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ?? "http://localhost:3001"}</code>.
        </div>
      )}
      {isLoading && !data && (
        <div className="rounded-sm border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Loading {period === "previous-month" ? "last month" : period === "month" ? "this month" : "live dashboard data"}…
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
  const denom = data.buyOffCount || 0;
  return (
    <div className="space-y-2">
      <div className="rounded-sm border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-4 text-primary" />
          {data.reportingPeriod === "month" ? "Calendar Month" : data.reportingPeriod === "week" ? "Last Completed Week" : "Production Window"}: {data.productionWindowStart || "—"} – {data.productionWindowEnd || "—"}
        </span>
        {data.productionDate && (
          <span className="text-xs font-normal text-muted-foreground">
            {data.reportingPeriod === "month" ? "Reporting month" : data.reportingPeriod === "week" ? "Reporting period" : "Production date"}: {data.productionDate}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Production and MasterCard summary
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
      <div className="w-full overflow-x-auto">
        <KpiTree
          data={data}
          denom={denom}
          pct={pct}
          reproComplete={reproComplete}
          onReproChange={onReproChange}
        />
      </div>
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
  const reproFilledCount = Math.max(0, Number.parseInt(reproComplete, 10) || 0);
  const reproFilledPercent = denom > 0 ? (reproFilledCount / denom) * 100 : 0;
  return (
    <div className="mx-auto w-full max-w-5xl pt-2 min-w-[560px]">
      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-6 md:col-span-3 rounded-sm border border-border border-t-4 border-t-primary bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Buy Offs</p>
              <h3 className="text-4xl font-bold tracking-tight text-primary tabular-nums">{data.buyOffCount ?? 0}</h3>
            </div>
            <div className="rounded-full bg-primary/10 p-2">
              <Gauge className="size-5 text-primary" />
            </div>
          </div>
          <p className="mt-3 text-xs font-medium italic text-muted-foreground">
            {data.buyOffCount ?? 0} unique Machine + Part jobs with Buyoff Accepted = Yes
          </p>
        </div>

        <div className="col-span-6 md:col-span-3 rounded-sm border border-border border-t-4 border-t-primary bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Repro Complete</p>
              <input
                type="text"
                inputMode="numeric"
                value={reproComplete}
                onChange={(e) => onReproChange(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
                className="w-full border-b border-transparent bg-transparent text-4xl font-bold tracking-tight text-primary tabular-nums outline-none focus:border-primary/40"
                aria-label="Repro Complete (manual entry)"
              />
            </div>
            <div className="rounded-full bg-primary/10 p-2">
              <BadgeCheck className="size-5 text-primary" />
            </div>
          </div>
          <p className="mt-3 text-xs font-medium italic text-muted-foreground">Manual total for this reporting period</p>
        </div>

        <div className="relative col-span-6 overflow-hidden rounded-sm border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:col-span-2">
          <div className="absolute inset-y-0 left-0 w-1 bg-success" />
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">MC Available</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground tabular-nums">{pct(data.mcAvailablePercent ?? 0)}</span>
            <span className="font-mono text-[11px] font-semibold text-muted-foreground">{data.mcAvailableCount ?? 0} OF {data.buyOffCount ?? 0}</span>
          </div>
          <p className="mt-2 text-[10px] leading-tight text-muted-foreground">MasterCard = Yes or Comparable</p>
        </div>

        <div className="relative col-span-6 overflow-hidden rounded-sm border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:col-span-2">
          <div className="absolute inset-y-0 left-0 w-1 bg-danger" />
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Missing / No MC</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground tabular-nums">{data.missingCount ?? 0}</span>
            <span className="font-mono text-[11px] font-semibold text-danger">{pct(data.missingPercent ?? 0)}</span>
          </div>
          <p className="mt-2 text-[10px] leading-tight text-muted-foreground">No / blank / missing data</p>
        </div>

        <div className="relative col-span-6 overflow-hidden rounded-sm border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:col-span-2">
          <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Repro Filled</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground tabular-nums">{pct(reproFilledPercent)}</span>
            <span className="font-mono text-[11px] font-semibold text-muted-foreground">
              {reproFilledCount} OF {denom}
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-tight text-muted-foreground">Repro Complete ÷ Buy Offs</p>
        </div>

        <div className="col-span-6 flex rounded-sm border border-border bg-secondary/40 md:col-span-3">
          <div className="flex-1 border-r border-border p-4">
            <p className="mb-1 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Matching</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-foreground tabular-nums">{data.matchingCount ?? 0}</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div className="h-full bg-success" style={{ width: `${data.matchingPercent ?? 0}%` }} />
              </div>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{pct(data.matchingPercent ?? 0)} · Exact match</p>
          </div>
          <div className="flex-1 p-4">
            <p className="mb-1 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Comparable</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-foreground tabular-nums">{data.comparableCount ?? 0}</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div className="h-full bg-warning" style={{ width: `${data.comparablePercent ?? 0}%` }} />
              </div>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{pct(data.comparablePercent ?? 0)} · Comparable</p>
          </div>
        </div>

        <div className="col-span-6 flex items-center justify-between rounded-sm border border-border bg-secondary/40 p-4 md:col-span-3">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data source</p>
            <p className="text-sm font-medium">SharePoint dashboard API</p>
            <p className="text-[10px] text-muted-foreground">Updated {data.updatedAt || "—"}</p>
          </div>
          <Activity className="size-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

function LiveLatestRowsTable({ data }: { data: DashboardData }) {
  return _LiveLatestRowsTableImpl({ data });
}

function MissingMcList({ data }: { data: DashboardData }) {
  const jobs = data.missingRows ?? [];
  const markCreated = useMarkMasterCardCreated();
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
      {jobs.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          No missing MasterCards in the selected reporting period.
        </div>
      ) : (
      <>
      {markCreated.error && (
        <div className="border-b border-danger/40 bg-danger/10 px-4 py-2 text-xs text-danger">
          {markCreated.error instanceof Error ? markCreated.error.message : "Could not update the MasterCard status"}
        </div>
      )}
      <div className="overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-hidden">
        <table className="w-full text-xs">
          <thead className="bg-background/50 text-muted-foreground uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left">Machine</th>
              <th className="px-3 py-2 text-left">Part Number</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Work Order</th>
              <th className="px-3 py-2 text-left">Tech</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Action</th>
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
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={markCreated.isPending}
                    onClick={() => markCreated.mutate(r.id)}
                    className="whitespace-nowrap rounded-sm bg-success px-2.5 py-1 text-[10px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {markCreated.isPending && markCreated.variables === r.id ? "Saving…" : "Mark MasterCard Created"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}

function _LiveLatestRowsTableImpl({ data }: { data: DashboardData }) {
  const latestRows = data?.latestRows || [];
  if (!latestRows.length) return null;
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
          {latestRows.length} rows
        </span>
      </div>
      <div className="overflow-auto scrollbar-hidden max-h-[420px]">
        <table className="w-full text-xs">
          <thead className="bg-card text-muted-foreground uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
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
            {latestRows.map((r) => (
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
  // Monthly scrap rate only (MasterCard availability removed).
  const data = useMemo(() => {
    return MONTHLY_SCRAP.map((p) => ({
      month: p.month,
      scrap: p.scrapRate,
    }));
  }, []);

  const avgScrap = (data.reduce((s, p) => s + p.scrap, 0) / data.length).toFixed(2);

  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Scrap Rate
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Monthly · scrap = scrap / (yield + scrap)</p>
        </div>
        <div className="flex gap-4 text-xs">
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
              domain={[0, 12]}
              tick={{ fontSize: 11 }}
              stroke="var(--danger)"
              label={{ value: "Scrap %", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--danger)" }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
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
  if (rate < 0.04) return "text-success";
  if (rate <= 0.05) return "text-warning";
  return "text-danger";
}

function MoldingScrapSection() {
  const { data, error, isLoading } = useMoldingScrap();
  if (!data) {
    return (
      <div className="rounded-sm border border-border bg-background/40 p-5 text-sm text-muted-foreground">
        {isLoading ? "Loading live Quality data from T2 Scrap.xlsm…" : `Live Quality data unavailable${error ? `: ${error}` : "."}`}
      </div>
    );
  }
  const { cellTotal, weeklyScrap, topProducts, topProductsTotal, topReasons, topReasonsTotal } = data;
  const maxCell = Math.max(...weeklyScrap.map((c) => c.scrapRate));
  const maxProd = Math.max(...topProducts.map((p) => p.scrap));
  const maxReason = Math.max(...topReasons.map((r) => r.scrap));
  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Molding — Weekly Scrap
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Source: T2 Scrap.xlsm · live PowerAppsQuality table
          </p>
        </div>
        <div className="flex gap-6 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cell Yield</div>
            <div className="text-lg font-bold">{fmtInt(cellTotal.yield)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cell Scrap</div>
            <div className="text-lg font-bold text-danger">{fmtInt(cellTotal.scrap)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Scrap Rate</div>
            <div className={`text-lg font-bold ${scrapTone(cellTotal.scrapRate)}`}>
              {fmtPct(cellTotal.scrapRate)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly scrap by cell */}
        <div className="rounded-sm border border-border bg-background/40 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Weekly Scrap by Cell
          </div>
          <div className="space-y-3">
            {weeklyScrap.map((c) => (
              <div key={c.cell}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold">{c.cell}</span>
                  <span className={`font-mono ${scrapTone(c.scrapRate)}`}>{fmtPct(c.scrapRate)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={`h-full ${c.scrapRate < 0.04 ? "bg-success" : c.scrapRate <= 0.05 ? "bg-warning" : "bg-danger"}`}
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
        <div className="rounded-sm border border-border bg-background/40 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Top 5 Scrap Products
          </div>
          <div className="space-y-2">
            {topProducts.map((p) => (
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
                {fmtInt(topProductsTotal.scrap)} scrap ·{" "}
                <span className={scrapTone(topProductsTotal.scrapRate)}>
                  {fmtPct(topProductsTotal.scrapRate)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Top 5 scrap reasons */}
        <div className="rounded-sm border border-border bg-background/40 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Top 5 Scrap Reasons
          </div>
          <div className="space-y-2">
            {topReasons.map((r) => (
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
                {fmtInt(topReasonsTotal.scrap)} / {fmtInt(topReasonsTotal.totalScrap)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MastercardsProductionChart() {
  const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const { data: production, isLoading, error } = useMastercardsProduction();

  const data = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const m of production?.monthlyMastercards ?? []) byMonth.set(m.month, m.count);
    return MONTHS.map((month) => ({ month, actual: byMonth.get(month) ?? 0 }));
  }, [production?.monthlyMastercards]);

  const ytdActual = production?.ytdProduced ?? 0;
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`;

  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            MasterCards Production by Month
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {error ? "SharePoint data unavailable" : isLoading ? "Loading SharePoint data…" : `Fiscal year ${production?.fiscalYearStart ?? ""}–${(production?.fiscalYearStart ?? 0) + 1}`}
          </p>
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

type TrendsMode = "month" | "year";
type TrendPoint = { key: string; label: string; value: number };
type RangePreset = "3m" | "6m" | "12m" | "all";

function trendPeriodKey(dateStr: string, mode: TrendsMode): string {
  return mode === "year" ? dateStr.slice(0, 4) : dateStr.slice(0, 7);
}

function trendPeriodLabel(key: string, mode: TrendsMode): string {
  if (mode === "year") return key;
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

/** Trims a monthly series down to the selected trailing window. Yearly buckets are too few to usefully range-filter, so this is a no-op in year mode. */
function applyRangePreset(points: TrendPoint[], mode: TrendsMode, range: RangePreset): TrendPoint[] {
  if (mode === "year" || range === "all") return points;
  const n = range === "3m" ? 3 : range === "6m" ? 6 : 12;
  return points.slice(-n);
}

/** Safety has no direct numeric feed — its trend is the % of recorded days that came back "ok". */
function aggregateSafetyHistory(history: Record<string, DayStatus>, mode: TrendsMode): TrendPoint[] {
  const buckets = new Map<string, { ok: number; total: number }>();
  for (const [day, status] of Object.entries(history)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const key = trendPeriodKey(day, mode);
    const bucket = buckets.get(key) ?? { ok: 0, total: 0 };
    bucket.total += 1;
    if (status === "ok") bucket.ok += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => ({ key, label: trendPeriodLabel(key, mode), value: b.total ? Math.round((b.ok / b.total) * 100) : 0 }));
}

/** Process/Product Deviation trend: real SharePoint deviation rows, counted per period, optionally narrowed to one machine. */
function aggregateDeviationCounts(rows: DeviationExcelRow[], kind: "process" | "product", mode: TrendsMode, machine?: string): TrendPoint[] {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    if (row.kind !== kind || !row.dateRequested) continue;
    if (machine && row.machine !== machine) continue;
    const key = trendPeriodKey(row.dateRequested, mode);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ key, label: trendPeriodLabel(key, mode), value: count }));
}

/** Distinct, sorted machine IDs actually present in a set of deviation rows — for the trend's machine filter. */
function distinctMachines(rows: DeviationExcelRow[], kind: "process" | "product"): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    if (row.kind === kind && row.machine) set.add(row.machine);
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Quality trend: the real monthly scrap-rate series already sourced from T2_Monthly_Scrap_Sheet2.csv. */
function aggregateScrapTrend(mode: TrendsMode): TrendPoint[] {
  if (mode === "month") {
    return MONTHLY_SCRAP.map((p) => ({
      key: `${p.year}-${String(p.monthIndex + 1).padStart(2, "0")}`,
      label: p.month,
      value: p.scrapRate,
    }));
  }
  const byYear = new Map<number, { yieldQty: number; scrap: number }>();
  for (const p of MONTHLY_SCRAP) {
    const bucket = byYear.get(p.year) ?? { yieldQty: 0, scrap: 0 };
    bucket.yieldQty += p.confirmedYield;
    bucket.scrap += p.confirmedScrap;
    byYear.set(p.year, bucket);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, b]) => {
      const denom = b.yieldQty + b.scrap;
      return { key: String(year), label: String(year), value: denom ? Math.round((b.scrap / denom) * 10000) / 100 : 0 };
    });
}

/** The 12 real calendar-month keys/labels of a Nov–Oct fiscal year, so a part filter can still zero-fill months with no production. */
function fiscalMonthKeys(fiscalYearStart: number): { key: string; label: string }[] {
  const FISCAL_START_MONTH = 10; // November, zero-indexed
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(fiscalYearStart, FISCAL_START_MONTH + i, 1));
    return {
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
    };
  });
}

/**
 * Productivity trend from the raw per-MasterCard rows, optionally narrowed to
 * one part. "Yearly" is a single bar totaling the fetched fiscal year (Nov–Oct)
 * rather than a calendar-year split — the hook only ever fetches one fiscal
 * year, and that window straddles two calendar years, so grouping by raw
 * calendar year would split one real fiscal year into two misleading
 * partial-year bars.
 */
function aggregateMastercardsTrend(
  rows: MastercardProductionRow[],
  mode: TrendsMode,
  fiscalYearStart?: number,
  part?: string,
): TrendPoint[] {
  const filtered = part ? rows.filter((r) => r.partNo === part) : rows;
  if (mode === "month") {
    if (fiscalYearStart == null) return [];
    const counts = new Map<string, number>();
    for (const r of filtered) counts.set(r.date.slice(0, 7), (counts.get(r.date.slice(0, 7)) ?? 0) + 1);
    return fiscalMonthKeys(fiscalYearStart).map(({ key, label }) => ({ key, label, value: counts.get(key) ?? 0 }));
  }
  if (!rows.length) return [];
  const label = fiscalYearStart != null ? `FY${fiscalYearStart}–${fiscalYearStart + 1}` : "This year";
  return [{ key: label, label, value: filtered.length }];
}

/** Distinct, sorted part numbers actually produced this fiscal year — for the trend's part filter. */
function distinctParts(rows: MastercardProductionRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.partNo) set.add(r.partNo);
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** A single-value animated ring — sweeps in the same way PillarGauge does, showing the latest reading as a fraction of the peak reading in the visible window. */
function MiniRing({ fraction, value, unit, size = 76 }: { fraction: number; value: number; unit: string; size?: number }) {
  const [sweep, setSweep] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setSweep(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, fraction));
  const len = circumference * clamped * (sweep ? 1 : 0);
  const center = size / 2;
  const animatedValue = useCountUp(value);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--secondary)" strokeWidth={stroke} />
        <circle
          cx={center} cy={center} r={radius} fill="none"
          stroke="var(--primary)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${len} ${Math.max(0, circumference - len)}`}
          style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <div className="text-lg font-extrabold tabular-nums tracking-tight">
            {animatedValue}
            {unit}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, height = 76 }: { data: TrendPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
          labelFormatter={(label) => label}
        />
        <Line
          type="natural"
          dataKey="value"
          stroke="var(--primary)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive
          animationDuration={1100}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TrendMiniChart({
  title,
  subtitle,
  data,
  icon: Icon,
  unit,
  height = 160,
  variant = "compact",
}: {
  title: string;
  subtitle: string;
  data: TrendPoint[];
  icon: typeof Shield;
  unit: string;
  height?: number;
  variant?: "compact" | "full";
}) {
  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const delta = latest && prev ? Math.round((latest.value - prev.value) * 100) / 100 : null;
  const peak = data.length ? Math.max(...data.map((d) => d.value), 0.0001) : 0;
  return (
    <div className="card-lift rounded-sm border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center shrink-0 size-8 rounded-sm bg-secondary text-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-bold tracking-tight">{title}</h4>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{ height }} className="mt-3 flex flex-col items-center justify-center gap-1.5 rounded-sm border border-dashed border-border text-muted-foreground">
          <Icon className="size-5 opacity-30" />
          <span className="text-xs">Not enough history yet</span>
        </div>
      ) : variant === "compact" ? (
        <div className="mt-3 flex items-center gap-4">
          <MiniRing fraction={latest.value / peak} value={latest.value} unit={unit} />
          <div className="min-w-0 flex-1">
            {data.length > 1 ? (
              <Sparkline data={data} height={64} />
            ) : (
              <p className="text-xs text-muted-foreground">Only one period of history so far — check back after another month.</p>
            )}
            {delta != null && delta !== 0 && (
              <div className={`text-[10px] font-semibold ${delta > 0 ? "text-success" : "text-danger"}`}>
                {delta > 0 ? "+" : ""}
                {delta}
                {unit} vs prior period
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-2xl font-extrabold tabular-nums tracking-tight">
              {latest.value}
              {unit}
            </div>
            {delta != null && delta !== 0 && (
              <div className={`text-xs font-semibold ${delta > 0 ? "text-success" : "text-danger"}`}>
                {delta > 0 ? "+" : ""}
                {delta}
                {unit} vs prior
              </div>
            )}
          </div>
          <div style={{ height }} className="mt-2 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={32} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}${unit}`, title]}
                />
                <Area
                  type="natural"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="var(--primary)"
                  fillOpacity={0.1}
                  dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function TrendsModal({
  focusPillar,
  onClose,
  onUnfocus,
  processDeviationRows,
  productDeviationRows,
}: {
  focusPillar: Pillar["key"] | null;
  onClose: () => void;
  onUnfocus: () => void;
  processDeviationRows: DeviationExcelRow[];
  productDeviationRows: DeviationExcelRow[];
}) {
  const [mode, setMode] = useState<TrendsMode>("month");
  const [range, setRange] = useState<RangePreset>("12m");
  const [machineFilter, setMachineFilter] = useState<string>("");
  const safetyHistory = usePillarDayHistory("S");
  const { data: mastercards } = useMastercardsProduction();

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

  // A machine/part picked while looking at one pillar shouldn't silently
  // carry over when switching to another.
  useEffect(() => {
    setMachineFilter("");
  }, [focusPillar]);

  const machineOptions =
    focusPillar === "D"
      ? distinctMachines(processDeviationRows, "process")
      : focusPillar === "I"
        ? distinctMachines(productDeviationRows, "product")
        : focusPillar === "P"
          ? distinctParts(mastercards?.rows ?? [])
          : [];
  const filterLabel = focusPillar === "P" ? "part" : "machine";
  const filterSuffix = machineFilter ? ` · ${focusPillar === "P" ? "Part" : "Machine"} ${machineFilter}` : "";

  const series: Record<Pillar["key"], { title: string; subtitle: string; data: TrendPoint[]; icon: typeof Shield; unit: string }> = {
    S: {
      title: "Safety",
      subtitle: (mode === "month" ? "Monthly OK rate" : "Yearly OK rate"),
      data: applyRangePreset(aggregateSafetyHistory(safetyHistory, mode), mode, range),
      icon: PILLARS.find((p) => p.key === "S")!.icon,
      unit: "%",
    },
    Q: {
      title: "Quality",
      subtitle: (mode === "month" ? "Monthly scrap rate" : "Yearly scrap rate"),
      data: applyRangePreset(aggregateScrapTrend(mode), mode, range),
      icon: PILLARS.find((p) => p.key === "Q")!.icon,
      unit: "%",
    },
    D: {
      title: "Process Deviation",
      subtitle: (mode === "month" ? "New deviations per month" : "New deviations per year") + (focusPillar === "D" ? filterSuffix : ""),
      data: applyRangePreset(
        aggregateDeviationCounts(processDeviationRows, "process", mode, focusPillar === "D" ? machineFilter || undefined : undefined),
        mode,
        range,
      ),
      icon: PILLARS.find((p) => p.key === "D")!.icon,
      unit: "",
    },
    I: {
      title: "Product Deviation",
      subtitle: (mode === "month" ? "New deviations per month" : "New deviations per year") + (focusPillar === "I" ? filterSuffix : ""),
      data: applyRangePreset(
        aggregateDeviationCounts(productDeviationRows, "product", mode, focusPillar === "I" ? machineFilter || undefined : undefined),
        mode,
        range,
      ),
      icon: PILLARS.find((p) => p.key === "I")!.icon,
      unit: "",
    },
    P: {
      title: "Productivity",
      subtitle: (mode === "month" ? "MasterCards produced per month" : "MasterCards produced this fiscal year") + (focusPillar === "P" ? filterSuffix : ""),
      data: applyRangePreset(
        aggregateMastercardsTrend(mastercards?.rows ?? [], mode, mastercards?.fiscalYearStart, focusPillar === "P" ? machineFilter || undefined : undefined),
        mode,
        range,
      ),
      icon: PILLARS.find((p) => p.key === "P")!.icon,
      unit: "",
    },
  };

  const pillarOrder: Pillar["key"][] = ["S", "Q", "D", "I", "P"];
  const showKeys = focusPillar ? [focusPillar] : pillarOrder;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-background/70 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="hide-scrollbar relative w-full max-w-[1200px] my-4 mx-4 rounded-sm border border-border overflow-y-auto bg-card shadow-2xl animate-scale-in origin-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {focusPillar ? PILLARS.find((p) => p.key === focusPillar)?.label : "All Pillars"}
            </div>
            <h2 className="text-xl font-bold tracking-tight">Trends</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-sm border border-border overflow-hidden text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode("month")}
                className={`px-3 py-1.5 transition ${mode === "month" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setMode("year")}
                className={`px-3 py-1.5 transition ${mode === "year" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"}`}
              >
                Yearly
              </button>
            </div>
            {mode === "month" && (
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as RangePreset)}
                aria-label="Time range"
                className="rounded-sm border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
              >
                <option value="3m">Last 3 months</option>
                <option value="6m">Last 6 months</option>
                <option value="12m">Last 12 months</option>
                <option value="all">All time</option>
              </select>
            )}
            {machineOptions.length > 0 && (
              <select
                value={machineFilter}
                onChange={(e) => setMachineFilter(e.target.value)}
                aria-label={`Filter by ${filterLabel}`}
                className="rounded-sm border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-primary"
              >
                <option value="">{focusPillar === "P" ? "All parts" : "All machines"}</option>
                {machineOptions.map((m) => (
                  <option key={m} value={m}>
                    {focusPillar === "P" ? "Part" : "Machine"} {m}
                  </option>
                ))}
              </select>
            )}
            {focusPillar && (
              <button type="button" onClick={onUnfocus} className="text-xs font-semibold text-primary hover:underline">
                ← All pillars
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid place-items-center size-9 rounded-sm border border-border bg-card hover:bg-secondary transition"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className={`grid grid-cols-1 gap-4 ${focusPillar ? "" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
            {showKeys.map((key) => (
              <TrendMiniChart
                key={key}
                title={series[key].title}
                subtitle={series[key].subtitle}
                data={series[key].data}
                icon={series[key].icon}
                unit={series[key].unit}
                height={focusPillar ? 320 : 160}
                variant={focusPillar ? "full" : "compact"}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
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

/** Eases a number up from 0 to `target` on mount/change — used for headline stat figures. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

/** Clean month-to-date score strip with direct counts instead of a percentage. */
function PillarGauge({
  okCount,
  warnCount,
  failCount,
}: {
  okCount: number;
  warnCount: number;
  failCount: number;
}) {
  const total = okCount + warnCount + failCount;
  const items = [
    { label: "OK", value: okCount, tone: "bg-success", surface: "border-success/30 bg-success/10 text-success" },
    { label: "Warning", value: warnCount, tone: "bg-warning", surface: "border-warning/30 bg-warning/10 text-warning" },
    { label: "Miss", value: failCount, tone: "bg-danger", surface: "border-danger/30 bg-danger/10 text-danger" },
  ];
  return (
    <div
      className="grid w-full grid-cols-3 gap-2"
      aria-label={`${total} month-to-date days recorded`}
    >
      {items.map((item) => (
        <div key={item.label} className={`relative overflow-hidden rounded-sm border px-3 py-2.5 ${item.surface}`}>
          <span className={`absolute inset-y-0 left-0 w-1 ${item.tone}`} aria-hidden="true" />
          <div className="flex items-end justify-between gap-2 pl-1">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] opacity-75">{item.label}</div>
              <div className="mt-1 text-2xl font-black leading-none tabular-nums">{item.value}</div>
            </div>
            <span className={`mb-0.5 size-2 rounded-full ${item.tone}`} aria-hidden="true" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PillarCard({
  pillar,
  history,
  liveToday,
  now,
  metricHistory,
  liveMetric,
  shifts,
  qualityIssues,
  qualityScrap,
  dashboardData,
  activeDeviationCount,
  todayDeviationCount,
  affectedAreaCount,
  remoteCommand,
  buyoffAlerts,
  buyoffAlertError,
  buyoffAlertLoading,
  onDateStatusChange,
  onSafetyIncidentsChange,
  isSavingSafetyIncidents,
  isSavingDateStatus,
  onOpenTrends,
  index = 0,
}: {
  pillar: Pillar;
  history: Record<string, DayStatus>;
  liveToday: DayStatus | null;
  now: Date;
  metricHistory: Record<string, number>;
  liveMetric: number | null;
  shifts: Status[];
  qualityIssues?: QualityIssue[];
  qualityScrap?: MoldingScrapData | null;
  dashboardData?: DashboardData | null;
  activeDeviationCount?: number;
  todayDeviationCount?: number;
  affectedAreaCount?: number;
  remoteCommand?: DashboardCommand | null;
  buyoffAlerts?: BuyoffRejectionAlert[];
  buyoffAlertError?: Error | null;
  buyoffAlertLoading?: boolean;
  onDateStatusChange: (day: string, status: DayStatus) => Promise<unknown>;
  onSafetyIncidentsChange?: (count: number) => Promise<unknown>;
  isSavingSafetyIncidents?: boolean;
  isSavingDateStatus?: boolean;
  onOpenTrends?: () => void;
  index?: number;
}) {
  const Icon = pillar.icon;
  const [expanded, setExpanded] = useState(false);
  const [calendarMonthOffset, setCalendarMonthOffset] = useState<0 | -1>(0);
  const displayedMonth = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + calendarMonthOffset, 1),
    [calendarMonthOffset, now.getFullYear(), now.getMonth()],
  );
  const dots = useMemo(
    () => buildMonthDotsFromHistory(displayedMonth, history, now, liveToday),
    [displayedMonth, history, liveToday, now],
  );
  const calendarLabel = displayedMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const metricForDay = (day: number): number | null => {
    const selected = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), day);
    const key = dateKey(selected);
    return key === dateKey(now) && liveMetric != null ? liveMetric : metricHistory[key] ?? null;
  };
  const formatDailyMetric = (value: number | null): string => {
    if (value == null) return "—";
    if (pillar.key === "Q" || pillar.key === "P") {
      return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`;
    }
    return String(Math.round(value));
  };
  const [areaStatusOverrides, setAreaStatusOverrides] = useLocalState<Record<string, Status>>(
    pillar.key === "S" ? "amg-safety-area-statuses" : `amg-area-statuses:${pillar.key}`,
    pillar.key === "S"
      ? Object.fromEntries(SHIFTS.map((area) => [area, "ok"])) as Record<string, Status>
      : {},
  );
  const [areaNotes, setAreaNotes] = useLocalState<Record<string, string>>(
    `amg-area-notes:${pillar.key}`,
    PILLAR_DETAILS[pillar.key].shiftNotes,
  );
  const effectiveShifts = SHIFTS.map((area, index) => {
    const saved = areaStatusOverrides[area];
    if (saved && saved !== "na") return saved;
    const live = shifts[index];
    return pillar.key === "S" && (!live || live === "na") ? "ok" : live;
  });
  const cycleAreaStatus = (area: (typeof SHIFTS)[number]) => {
    const order: Status[] = ["ok", "warn", "fail"];
    setAreaStatusOverrides((current) => {
      const saved = current[area];
      const liveStatus = effectiveShifts[SHIFTS.indexOf(area)];
      const status = !saved || saved === "na" ? liveStatus : saved;
      return {
        ...current,
        [area]: order[(order.indexOf(status) + 1) % order.length],
      };
    });
  };
  useEffect(() => {
    if (!remoteCommand) return;
    if (remoteCommand.command === "CloseAll") setExpanded(false);
    if (remoteCommand.command === "OpenPillar") setExpanded(remoteCommand.target === pillar.key);
  }, [remoteCommand?.id, remoteCommand?.command, remoteCommand?.target, pillar.key]);
  const recordedDays = dots.filter((dot) => !dot.weekend && dot.status !== "na").length;
  const recordedOkDays = dots.filter((dot) => !dot.weekend && dot.status === "ok").length;
  const currentStatus = liveToday ?? history[dateKey(now)] ?? "na";
  const currentStatusLabel = currentStatus === "ok" ? "OK" : currentStatus === "warn" ? "Warning" : currentStatus === "fail" ? "Miss" : "Not recorded";
  const affectedShifts =
    pillar.key === "D" || pillar.key === "I"
      ? affectedAreaCount ?? 0
      : effectiveShifts.filter((status) => status === "fail").length;
  const liveStats: PillarDetail["stats"] =
    pillar.key === "S"
      ? [
          { label: "Today's safety", value: currentStatusLabel },
          { label: "Recorded days MTD", value: fmtInt(recordedDays) },
          { label: "MTD OK rate", value: recordedDays ? `${Math.round((recordedOkDays / recordedDays) * 100)}%` : "—" },
        ]
      : pillar.key === "Q"
        ? qualityScrap
          ? [
              { label: "Weekly scrap", value: fmtPct(qualityScrap.cellTotal.scrapRate) },
              { label: "Good pieces", value: fmtInt(qualityScrap.cellTotal.yield) },
              { label: "Scrap pieces", value: fmtInt(qualityScrap.cellTotal.scrap) },
            ]
          : [
              { label: "Weekly scrap", value: "Unavailable" },
              { label: "Good pieces", value: "—" },
              { label: "Scrap pieces", value: "—" },
            ]
        : pillar.key === "D" || pillar.key === "I"
          ? [
              { label: "Active deviations", value: fmtInt(activeDeviationCount ?? 0) },
              { label: "New today", value: fmtInt(todayDeviationCount ?? 0) },
              { label: "Affected areas", value: `${affectedShifts} / ${SHIFTS.length}` },
            ]
          : dashboardData
            ? [
                { label: "MasterCard availability", value: `${Math.round(dashboardData.mcAvailablePercent)}%` },
                { label: "Machines Running", value: fmtInt(dashboardData.buyOffCount) },
                { label: "Missing MasterCards", value: fmtInt(dashboardData.missingCount) },
              ]
            : [
                { label: "MasterCard availability", value: "Unavailable" },
                { label: "Machines Running", value: "—" },
                { label: "Missing MasterCards", value: "—" },
              ];
  const detail = { ...PILLAR_DETAILS[pillar.key], stats: liveStats };
  const kpiText = pillar.kpi;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Safety has no automatic live signal — today's status is only ever a
  // real, manual entry, recorded straight into the same day-history store
  // the other pillars write to (see use-pillar-day-history.ts).
  const cycleDateStatus = (day: number, current: Status) => {
    const order: DayStatus[] = ["ok", "warn", "fail"];
    const next = order[(order.indexOf(current as DayStatus) + 1) % order.length];
    const selected = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), day);
    const selectedDay = dateKey(selected);
    recordPillarDay(pillar.key, selectedDay, next);
    void onDateStatusChange(selectedDay, next);
  };
  const okCount = dots.filter((d) => d.status === "ok").length;
  const failCount = dots.filter((d) => d.status === "fail").length;
  const warnCount = dots.filter((d) => d.status === "warn").length;

  return (
    <div
      onClick={(event) => {
        if (expanded) return;
        const target = event.target as HTMLElement;
        if (target.closest("button:not(:disabled), a, input, select, textarea, label")) return;
        setExpanded(true);
      }}
      className="card-lift card-enter relative h-full min-h-[520px] cursor-pointer rounded-sm border border-border border-t-2 border-t-primary bg-card shadow-[var(--shadow-card)]"
      style={{ "--card-i": index } as React.CSSProperties}
    >
      <div className="relative p-5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-start justify-between text-left cursor-pointer group"
        >
          <div>
            <div className="flex items-center gap-2.5">
              <StackLight status={currentStatus} />
              <span className="grid place-items-center shrink-0 size-9 rounded-sm bg-primary text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Performance pillar</div>
                <div className="text-lg font-extrabold tracking-tight">{pillar.label}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {onOpenTrends && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTrends();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    onOpenTrends();
                  }
                }}
                title={`${pillar.label} — monthly and yearly trends`}
                aria-label={`${pillar.label} trends`}
                className="grid place-items-center size-7 rounded-sm border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <BarChart3 className="size-3.5" />
              </span>
            )}
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""} group-hover:text-foreground`}
            />
          </div>
        </button>

        <div className="mt-3">
          <p className="mb-2 text-xs text-muted-foreground">KPI: {kpiText}</p>
          <PillarGauge okCount={okCount} warnCount={warnCount} failCount={failCount} />
        </div>

        {/* Calendar month navigation */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={calendarMonthOffset === -1}
            onClick={(event) => {
              event.stopPropagation();
              setCalendarMonthOffset(-1);
            }}
            title="Show last month's date balls"
            aria-label={`Show previous month for ${pillar.label}`}
            className="grid size-7 place-items-center rounded-sm border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-default disabled:opacity-35"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {calendarLabel}
          </div>
          <button
            type="button"
            disabled={calendarMonthOffset === 0}
            onClick={(event) => {
              event.stopPropagation();
              setCalendarMonthOffset(0);
            }}
            title="Return to the current month's date balls"
            aria-label={`Show current month for ${pillar.label}`}
            className="grid size-7 place-items-center rounded-sm border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-default disabled:opacity-35"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Day dots grid */}
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {dots.map((d) => {
            const selectedDate = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), d.day);
            const editable = !d.weekend && selectedDate.getTime() <= todayStart && !isSavingDateStatus;
            const metric = metricForDay(d.day);
            if (d.weekend) {
              return (
                <div
                  key={d.day}
                  title={`Day ${d.day} — weekend`}
                  aria-label={`Day ${d.day}, weekend`}
                  className="flex h-9 min-w-0 flex-col items-center justify-center rounded-sm bg-accent/25 text-foreground ring-1 ring-accent/40"
                >
                  <span className="text-[8px] font-semibold opacity-70">{d.day}</span>
                  <span className="text-[9px] font-bold">—</span>
                </div>
              );
            }
            return (
              <button
                key={d.day}
                type="button"
                disabled={!editable}
                onClick={
                  editable
                    ? (e) => {
                        e.stopPropagation();
                        cycleDateStatus(d.day, d.status);
                      }
                    : undefined
                }
                title={
                  editable
                    ? `Day ${d.day}: ${formatDailyMetric(metric)} — click to change status`
                    : `Day ${d.day}: ${formatDailyMetric(metric)}`
                }
                className={`flex h-9 min-w-0 flex-col items-center justify-center rounded-sm text-background ${
                  d.status === "na"
                    ? "bg-secondary text-muted-foreground"
                    : statusColor(d.status)
                } ${editable ? "cursor-pointer ring-1 ring-primary/60 hover:scale-110 transition-transform" : "cursor-default"}`}
              >
                <span className="text-[8px] font-semibold opacity-75">{d.day}</span>
                <span className="max-w-full truncate text-[9px] font-black tabular-nums">{formatDailyMetric(metric)}</span>
              </button>
            );
          })}
        </div>

        {/* Production cells / areas */}
        <div className="mt-4 border-t border-border/60 pt-4 space-y-2">
          {pillar.key === "Q" ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 text-center">
                Weekly Scrap Rates
              </div>
              <div className="relative h-32 border-l border-b border-border/60">
                <div className="absolute inset-0 flex items-end justify-around px-1 gap-1">
                  {(qualityScrap?.weeklyScrap ?? []).map((c) => {
                    const colors: Record<string, string> = {
                      LD: "#ea7a2b",
                      MD: "#1f6fd0",
                      SD1: "#e2231a",
                      SD2: "#1fa84c",
                      FS: "#111111",
                    };
                    const maxRate = Math.max(...(qualityScrap?.weeklyScrap ?? []).map((x) => x.scrapRate), 0.01);
                    const heightPct = Math.max(4, (c.scrapRate / maxRate) * 92);
                    return (
                      <div key={c.cell} className="flex flex-col items-center justify-end h-full flex-1">
                        <span className="text-[9px] font-semibold text-foreground mb-0.5">
                          {(c.scrapRate * 100).toFixed(1)}%
                        </span>
                        <div
                          className="w-full max-w-[22px] rounded-sm"
                          style={{ height: `${heightPct}%`, backgroundColor: colors[c.cell] ?? "#666" }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-around px-1 gap-1 mt-1">
                {(qualityScrap?.weeklyScrap ?? []).map((c) => (
                  <div key={c.cell} className="flex-1 text-center text-[10px] font-semibold text-muted-foreground">
                    {c.cell}
                  </div>
                ))}
              </div>
              {!qualityScrap && (
                <div className="mt-3 text-center text-xs text-muted-foreground">Loading live Quality data…</div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {SHIFTS.map((s, i) => (
                <div key={s} className="flex items-center justify-between text-xs rounded-md bg-secondary/30 px-2 py-1.5">
                  <span className="font-medium text-muted-foreground">{s}</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      cycleAreaStatus(s);
                    }}
                    title={`${s}: ${effectiveShifts[i]}. Click to change.`}
                    aria-label={`Change ${s} ${pillar.label} production-area status`}
                    className={`size-2.5 rounded-full transition hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${statusColor(effectiveShifts[i])}`}
                  />
                </div>
              ))}
            </div>
          )}
          {pillar.key === "P" && buyoffAlerts && (
            <div className="pt-2 border-t border-dashed border-border/60">
              <BuyoffAlertMonitor
                alerts={buyoffAlerts}
                error={buyoffAlertError ?? null}
                isLoading={buyoffAlertLoading ?? false}
              />
            </div>
          )}
          {pillar.key === "Q" && qualityScrap && (
            <div className="pt-2 border-t border-dashed border-border/60">
              <QualityTopIssuesCard data={qualityScrap} compact />
            </div>
          )}
          {(pillar.key === "D" || pillar.key === "I") && (
            <div className="pt-2 border-t border-dashed border-border/60">
              <DeviationTopFiveCard pillarKey={pillar.key as DeviationPillarKey} compact />
            </div>
          )}
          {pillar.key === "S" && (
            <div className="pt-2 border-t border-dashed border-border/60">
              <TopIssuesCard
                pillarKey="S"
                title="Safety Concerns"
                placeholder="Add a safety concern…"
                compact
              />
            </div>
          )}
        </div>
      </div>
      {expanded && (
        <PillarDetailOverlay
          pillar={pillar}
          detail={detail}
          dots={dots}
          shifts={effectiveShifts}
          qualityIssues={qualityIssues}
          qualityScrap={qualityScrap}
          kpiText={kpiText}
          buyoffAlerts={buyoffAlerts}
          buyoffAlertError={buyoffAlertError}
          buyoffAlertLoading={buyoffAlertLoading}
          onCycleSafetyArea={cycleAreaStatus}
          areaNotes={areaNotes}
          calendarLabel={calendarLabel}
          dailyMetricLabels={Object.fromEntries(dots.map((dot) => [dot.day, formatDailyMetric(metricForDay(dot.day))]))}
          safetyIncidentCount={pillar.key === "S" ? liveMetric ?? 0 : 0}
          onSafetyIncidentsChange={onSafetyIncidentsChange}
          isSavingSafetyIncidents={isSavingSafetyIncidents}
          onAreaNoteChange={(area, note) =>
            setAreaNotes((current) => ({ ...current, [area]: note }))
          }
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
      className={`absolute rounded-sm border p-1.5 flex flex-col min-h-0 overflow-hidden ${
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
    <div className="w-full overflow-x-auto -mx-2 px-2">
    <div
      className="relative h-[520px] sm:h-[640px] min-w-[720px] rounded-sm border-2 border-border bg-background/40 overflow-hidden"
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
  const [viewMode, setViewMode] = useState<"today" | "previous">("today");
  const manualDeviationsToday = useDeviationMapToday(pillarKey);
  const { data: deviationDashboardData } = useDashboardData();
  const { data: deviationData = { processParts: [], processMachines: [], productParts: [], rows: [] } } = useProcessDeviationList();
  const { data: productDeviationData = { productParts: [], rows: [] } } = useProductDeviations();
  // "Previous" is intentionally independent of the buyoff snapshot's
  // productionDate. That snapshot can already be today's date, which made
  // both tabs display the same deviations. Monday looks back to Friday.
  const previousDate = previousProductionDayKey();
  const previousManualIds = useDeviationsOnDate(pillarKey, previousDate);

  // Excel rows -> floor-tile IDs. The Machine column is directly populated
  // for both Process and Product deviations in Document Number.xlsm, so it's
  // always preferred; the part->today's-job lookup only kicks in as a
  // fallback for the rare row where Machine was left blank.
  const matchFloorMachine = (rawMachine: string) =>
    FLOOR_LAYOUT.flatMap((zone) => zone.machines).find(
      (machine) => shiftMachineId(machine) === shiftMachineId(rawMachine),
    ) ?? rawMachine;
  const kindForPillar = pillarKey === "D" ? "process" : "product";
  const sourceRows = pillarKey === "D" ? deviationData.rows : productDeviationData.rows;
  const deriveMachineIds = (predicate: (row: DeviationExcelRow) => boolean): Set<string> => {
    const ids = new Set<string>();
    for (const row of sourceRows) {
      if (row.kind !== kindForPillar || !predicate(row)) continue;
      if (row.machine) {
        ids.add(matchFloorMachine(row.machine));
        continue;
      }
      // Process deviations must resolve through PRD_Approvals.Machine_ID ->
      // Machines.ID -> Machines.LRM. Never infer a process machine from its
      // part number because the same part may run on multiple machines.
      if (pillarKey === "D") continue;
      if (!row.part) continue;
      const job = deviationDashboardData?.machineJobs?.find(
        (j) => j.partNumber.toUpperCase().replace(/\s+/g, "") === row.part,
      );
      if (job) ids.add(matchFloorMachine(job.machine));
    }
    return ids;
  };

  const todayStr = dateKey(new Date());
  const automaticTodayIds = deriveMachineIds(
    (row) => !row.closed && row.dateRequested === todayStr,
  );
  const automaticPreviousIds = deriveMachineIds(
    (row) => row.dateRequested === previousDate,
  );
  const todayRecordCount = sourceRows.filter(
    (row) =>
      row.kind === kindForPillar &&
      !row.closed &&
      (pillarKey !== "D" || !!row.machine) &&
      row.dateRequested === todayStr,
  ).length;
  const previousRecordCount = sourceRows.filter(
    (row) =>
      row.kind === kindForPillar &&
      (pillarKey === "D" || !row.closed) &&
      (pillarKey !== "D" || !!row.machine) &&
      row.dateRequested === previousDate,
  ).length;
  const hasTodayData = todayRecordCount > 0 || Object.keys(manualDeviationsToday).length > 0;
  const previousManualIdsForPillar = pillarKey === "D" ? [] : previousManualIds;
  const hasPreviousData = previousRecordCount > 0 || previousManualIdsForPillar.length > 0;
  useEffect(() => {
    if (!hasTodayData && hasPreviousData) setViewMode("previous");
  }, [hasTodayData, hasPreviousData, previousDate]);

  const isToday = viewMode === "today";
  const deviations = isToday
    ? {
        ...Object.fromEntries([...automaticTodayIds].map((machine) => [machine, todayStr])),
        ...manualDeviationsToday,
      }
    : {
        ...Object.fromEntries([...automaticPreviousIds].map((machine) => [machine, previousDate])),
        ...Object.fromEntries(previousManualIdsForPillar.map((id) => [id, previousDate])),
      };
  const machineCount = Object.keys(deviations).length;
  const deviationCount = isToday
    ? todayRecordCount + Object.keys(manualDeviationsToday).length
    : previousRecordCount + previousManualIdsForPillar.length;
  const displayId = (id: string) => id.replace(/(IM|EM|AM)\d*$/i, "");

  const label = pillarKey === "D" ? "Process Deviation" : "Product Deviation";
  const rule =
    pillarKey === "D"
      ? "Red when > 3 new process deviations"
      : "Red on ≥ 1 new product deviation";

  const Tile = ({ id }: { id: string }) => {
    const flagged = !!deviations[id];
    return (
      <button
        type="button"
        disabled={!isToday}
        onClick={() => toggleDeviation(pillarKey, id)}
        title={
          isToday
            ? `${id} — click to ${flagged ? "clear" : "flag"} deviation`
            : `${id} — ${flagged ? "flagged" : "no deviation"} on ${previousDate}`
        }
        className={`relative rounded-sm border px-1 py-1 font-mono font-bold leading-none flex items-center justify-center min-w-0 transition text-sm sm:text-base ${
          isToday ? "cursor-pointer hover:brightness-110" : "cursor-default"
        } ${
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
      className={`absolute rounded-sm border p-1.5 flex flex-col min-h-0 overflow-hidden border-border/60 bg-secondary/20 ${className ?? ""}`}
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
            {isToday
              ? <>Manual input. Click a machine to flag / clear a deviation. {rule}.</>
              : `Read-only — SharePoint deviations from the previous production date (${previousDate}).`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border/60 overflow-hidden text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("today")}
              className={`px-2 py-1 transition ${isToday ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setViewMode("previous")}
              className={`px-2 py-1 transition border-l border-border/60 ${!isToday ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
            >
              Previous
            </button>
          </div>
          <span className="rounded-md border border-border/60 bg-card px-2 py-1 text-xs font-semibold">
            {deviationCount} deviations · {machineCount} machines
          </span>
          {isToday && (
            <button
              type="button"
              onClick={() => clearDeviations(pillarKey)}
              disabled={Object.keys(manualDeviationsToday).length === 0}
              className="rounded-md border border-border/60 bg-card px-2 py-1 text-xs font-semibold hover:bg-secondary transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
      <div className="w-full overflow-x-auto -mx-2 px-2">
      <div
        className="relative h-[520px] sm:h-[640px] min-w-[720px] rounded-sm border-2 border-border bg-background/40 overflow-hidden"
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

function ProductivityDetailStats({ period }: { period: DashboardPeriod }) {
  const { data, isLoading } = useDashboardData(period);
  const stats = data
    ? [
        { label: "MasterCard availability", value: `${Math.round(data.mcAvailablePercent)}%` },
        { label: period !== "production-day" ? "Monthly buyoffs" : "Machines Running", value: fmtInt(data.buyOffCount) },
        { label: "Missing MasterCards", value: fmtInt(data.missingCount) },
      ]
    : [
        { label: "MasterCard availability", value: isLoading ? "Loading…" : "Unavailable" },
        { label: period !== "production-day" ? "Monthly buyoffs" : "Machines Running", value: "—" },
        { label: "Missing MasterCards", value: "—" },
      ];
  return stats.map((stat) => (
    <div key={stat.label} className="rounded-sm border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-primary">{stat.value}</div>
    </div>
  ));
}

function PillarDetailOverlay({
  pillar,
  detail,
  dots,
  shifts,
  qualityIssues,
  qualityScrap,
  kpiText,
  buyoffAlerts,
  buyoffAlertError,
  buyoffAlertLoading,
  onCycleSafetyArea,
  areaNotes,
  calendarLabel,
  dailyMetricLabels,
  safetyIncidentCount,
  onSafetyIncidentsChange,
  isSavingSafetyIncidents,
  onAreaNoteChange,
  onClose,
}: {
  pillar: Pillar;
  detail: PillarDetail;
  dots: { day: number; status: Status; weekend?: boolean }[];
  shifts: Status[];
  qualityIssues?: QualityIssue[];
  qualityScrap?: MoldingScrapData | null;
  kpiText: string;
  buyoffAlerts?: BuyoffRejectionAlert[];
  buyoffAlertError?: Error | null;
  buyoffAlertLoading?: boolean;
  onCycleSafetyArea: (area: (typeof SHIFTS)[number]) => void;
  areaNotes: Record<string, string>;
  calendarLabel: string;
  dailyMetricLabels: Record<number, string>;
  safetyIncidentCount: number;
  onSafetyIncidentsChange?: (count: number) => Promise<unknown>;
  isSavingSafetyIncidents?: boolean;
  onAreaNoteChange: (area: (typeof SHIFTS)[number], note: string) => void;
  onClose: () => void;
}) {
  const Icon = pillar.icon;
  const [productivityPeriod, setProductivityPeriod] = useState<DashboardPeriod>("production-day");
  const [safetyIncidentDraft, setSafetyIncidentDraft] = useState(String(safetyIncidentCount));
  useEffect(() => setSafetyIncidentDraft(String(safetyIncidentCount)), [safetyIncidentCount]);
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-background/70 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="hide-scrollbar sheet-enter relative w-full max-w-[1500px] my-4 mx-4 rounded-sm border border-border overflow-y-auto bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="grid place-items-center size-14 rounded-sm bg-primary text-primary-foreground shadow-md">
                <Icon className="size-7" />
              </span>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Pillar Detail</div>
                <h2 className="text-3xl font-bold tracking-tight">{pillar.label}</h2>
                <p className="text-sm text-muted-foreground mt-1">KPI: {kpiText}</p>
                {pillar.key === "P" && <p className="mt-1 text-xs font-semibold text-primary">Scroll down for live buyoff tables ↓</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid place-items-center size-10 rounded-sm border border-border bg-card hover:bg-secondary transition"
            >
              <X className="size-5" />
            </button>
          </div>

          {pillar.key === "P" && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-primary" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Productivity filter</h3>
                  <p className="text-[10px] text-muted-foreground">Change the KPI summary and buyoff tables together.</p>
                </div>
              </div>
              <div className="inline-flex overflow-hidden rounded-sm border border-border" role="group" aria-label="Productivity reporting period">
                <button
                  type="button"
                  onClick={() => setProductivityPeriod("production-day")}
                  aria-pressed={productivityPeriod === "production-day"}
                  className={`px-3 py-1.5 text-xs font-semibold transition ${
                    productivityPeriod === "production-day"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Production Day
                </button>
                <button
                  type="button"
                  onClick={() => setProductivityPeriod("month")}
                  aria-pressed={productivityPeriod === "month"}
                  className={`border-l border-border px-3 py-1.5 text-xs font-semibold transition ${
                    productivityPeriod === "month"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setProductivityPeriod("previous-month")}
                  aria-pressed={productivityPeriod === "previous-month"}
                  className={`border-l border-border px-3 py-1.5 text-xs font-semibold transition ${
                    productivityPeriod === "previous-month"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Last Month
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-sm border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Month Score</div>
              <div className="mt-1 flex items-baseline gap-2 text-sm">
                <span className="text-success font-bold">{okCount} ok</span>
                <span className="text-warning font-bold">{warnCount} warn</span>
                <span className="text-danger font-bold">{failCount} miss</span>
              </div>
            </div>
            {pillar.key === "P" ? (
              <ProductivityDetailStats period={productivityPeriod} />
            ) : detail.stats.map((s) => (
              <div
                key={s.label}
                className="rounded-sm border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-primary">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {(pillar.key === "D" || pillar.key === "I") && (
              <section className="lg:col-span-3 rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
                <DeviationFloor pillarKey={pillar.key as DeviationPillarKey} />
              </section>
            )}

            {pillar.key === "P" && (
              <>
                <section className="lg:col-span-3 rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-danger">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Repeated Buyoff Rejections — Last 24 Hours
                  </h3>
                  <BuyoffAlertMonitor
                    alerts={buyoffAlerts ?? []}
                    error={buyoffAlertError ?? null}
                    isLoading={buyoffAlertLoading ?? false}
                    expanded
                  />
                </section>
                <section className="lg:col-span-3 rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
                  <LiveDashboardSection period={productivityPeriod} />
                </section>
                <section className="lg:col-span-3 rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
                  <PafBuyoffTable period={productivityPeriod} />
                </section>
                <section className="lg:col-span-3 rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
                  <ExtrusionBuyoffTable period={productivityPeriod} />
                </section>
                <section className="lg:col-span-3 rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
                  <MastercardsProductionChart />
                </section>
                <section className="lg:col-span-3 rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
                  <IntouchFloor />
                </section>
              </>
            )}

            {pillar.key === "Q" && (
              <>
                <section className="lg:col-span-3 rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
                  <MoldingScrapSection />
                </section>
                <section className="lg:col-span-3 rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
                  <AvailabilityScrapChart />
                </section>
              </>
            )}

            {pillar.key === "S" && (
              <>
                <section className="lg:col-span-3 rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Today's Safety Incidents</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Enter the confirmed incident count for today's date tracker.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={safetyIncidentDraft}
                        onChange={(event) => setSafetyIncidentDraft(event.target.value.replace(/[^0-9]/g, ""))}
                        aria-label="Today's Safety incident count"
                        className="h-10 w-24 rounded-sm border border-border bg-background px-3 text-center text-lg font-bold tabular-nums outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        disabled={!onSafetyIncidentsChange || isSavingSafetyIncidents || safetyIncidentDraft === ""}
                        onClick={() => void onSafetyIncidentsChange?.(Math.max(0, Number.parseInt(safetyIncidentDraft, 10) || 0))}
                        className="h-10 rounded-sm bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                      >
                        {isSavingSafetyIncidents ? "Saving…" : "Save incidents"}
                      </button>
                    </div>
                  </div>
                </section>
                <section className="rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Production Areas</h3>
                  <div className="space-y-3">
                    {SHIFTS.map((s, i) => (
                      <div key={s} className="flex items-center justify-between text-sm gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => onCycleSafetyArea(s)}
                            title={`${s}: ${shifts[i]}. Click to change.`}
                            aria-label={`Change ${s} safety status`}
                            className={`size-3 rounded-full shrink-0 transition hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${statusColor(shifts[i])}`}
                          />
                          <span className="font-semibold w-12 shrink-0">{s}</span>
                          <input
                            value={areaNotes[s] ?? ""}
                            onChange={(event) => onAreaNoteChange(s, event.target.value)}
                            placeholder="Add comment…"
                            aria-label={`${s} production-area comment`}
                            className="min-w-0 flex-1 border-b border-transparent bg-transparent text-xs text-muted-foreground outline-none transition focus:border-primary focus:text-foreground"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="lg:col-span-2 rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Monthly Status</h3>
                  <p className="mb-4 text-xs font-semibold text-primary">{calendarLabel}</p>
                  <div className="grid grid-cols-7 gap-2">
                    {dots.map((d) => (
                      <div
                        key={d.day}
                        className={`flex h-11 min-w-0 flex-col items-center justify-center rounded-sm ${
                          d.weekend
                            ? "bg-accent/25 text-foreground ring-1 ring-accent/40"
                            : d.status === "na"
                              ? "bg-secondary text-muted-foreground"
                              : `text-background ${statusColor(d.status)}`
                        }`}
                      >
                        <span className="text-[9px] font-semibold opacity-70">{d.day}</span>
                        <span className="text-xs font-black tabular-nums">{dailyMetricLabels[d.day] ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded-full bg-success" />
                      {okCount} ok
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded-full bg-warning" />
                      {warnCount} warn
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded-full bg-danger" />
                      {failCount} miss
                    </span>
                  </div>
                </section>
              </>
            )}

            {pillar.key === "Q" && qualityScrap && <QualityTopIssuesCard data={qualityScrap} />}
            {(pillar.key === "D" || pillar.key === "I") && (
              <DeviationTopFiveCard pillarKey={pillar.key as DeviationPillarKey} />
            )}
            {pillar.key === "S" && (
              <TopIssuesCard
                pillarKey="S"
                title="Safety Concerns"
                placeholder="Add a safety concern…"
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PafBuyoffTable({ period = "production-day" }: { period?: DashboardPeriod }) {
  const { data = [], isLoading, error, dataUpdatedAt } = usePafBuyoffs(period);
  const periodLabel = period === "month" ? "Current-month" : period === "previous-month" ? "Previous-month" : "Current production-day";
  return (
    <BuyoffLogTable
      title="Coils & Collars Buyoff Log"
      description={`${periodLabel} records from the PAF Buyoff Structure SharePoint list`}
      emptyLabel="No Coils & Collars buyoff records found."
      data={data}
      isLoading={isLoading}
      error={error}
      dataUpdatedAt={dataUpdatedAt}
    />
  );
}

function ExtrusionBuyoffTable({ period = "production-day" }: { period?: DashboardPeriod }) {
  const { data = [], isLoading, error, dataUpdatedAt } = useExtrusionBuyoffs(period);
  const periodLabel = period === "month" ? "Current-month" : period === "previous-month" ? "Previous-month" : "Latest";
  return (
    <BuyoffLogTable
      title="Extrusion Buyoff Log"
      description={period === "production-day" ? "Latest records from the Extrusion SharePoint list · 7 AM–7 AM reporting day" : `${periodLabel} records from the Extrusion SharePoint list`}
      emptyLabel="No Extrusion buyoff records found."
      data={data}
      isLoading={isLoading}
      error={error}
      dataUpdatedAt={dataUpdatedAt}
    />
  );
}

function BuyoffLogTable({
  title,
  description,
  emptyLabel,
  data,
  isLoading,
  error,
  dataUpdatedAt,
}: {
  title: string;
  description: string;
  emptyLabel: string;
  data: PafBuyoff[];
  isLoading: boolean;
  error: Error | null;
  dataUpdatedAt: number;
}) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {isLoading ? "Loading…" : dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
      </div>
      {error && <p className="mb-3 text-xs text-danger">{error instanceof Error ? error.message : "PAF buyoff records unavailable"}</p>}
      <div className="overflow-x-auto rounded-sm border border-border">
        <table className="w-full min-w-[1050px] text-left text-xs">
          <thead className="bg-secondary/60 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Time In</th>
              <th className="px-3 py-2">Machine</th>
              <th className="px-3 py-2">Work Order</th>
              <th className="px-3 py-2">Part Number</th>
              <th className="px-3 py-2">Part Description</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Shift</th>
              <th className="px-3 py-2">QC Tech</th>
              <th className="px-3 py-2">Acceptance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((row) => (
              <tr key={row.id} className="hover:bg-secondary/30">
                <td className="whitespace-nowrap px-3 py-2">{row.date ? new Date(row.date).toLocaleDateString() : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.timeIn || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 font-semibold">{row.machine || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.workOrder || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.partNumber || "—"}</td>
                <td className="max-w-[260px] truncate px-3 py-2" title={row.partDescription}>{row.partDescription || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.buyoffType || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.shift || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.qcTech || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 font-semibold">{row.acceptance || "—"}</td>
              </tr>
            ))}
            {!isLoading && data.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">{emptyLabel}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ActionItem = Pick<DashboardTask, "task" | "owner" | "due">;

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

function AutoTextarea({ value, onChange, onCommit, compact, placeholder }: { value: string; onChange: (v: string) => void; onCommit?: (v: string) => void; compact?: boolean; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [value, compact]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onCommit?.(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          ref.current?.blur();
        }
      }}
      rows={1}
      placeholder={placeholder}
      className={`flex-1 resize-none overflow-hidden bg-transparent outline-none border-b border-transparent focus:border-border/60 py-0.5 min-w-0 leading-snug ${compact ? "text-xs" : "text-sm"}`}
    />
  );
}

function QualityTopIssuesCard({ data, compact = false }: { data: MoldingScrapData; compact?: boolean }) {
  const issues = data.topReasons.slice(0, compact ? 3 : 5);
  return (
    <section className={`rounded-sm border bg-card min-w-0 ${compact ? "border-border/60 p-4" : "border-border shadow-[var(--shadow-card)] border-t-2 border-t-primary p-6"}`}>
      <div className="mb-4">
        <h3 className={`font-bold uppercase tracking-wider text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>Top Issues</h3>
        <p className="mt-1 text-[10px] text-muted-foreground">Live scrap reasons from T2 Scrap.xlsm</p>
      </div>
      <ul className={compact ? "space-y-2" : "space-y-3"}>
        {issues.map((issue) => (
          <li key={issue.reason} className="flex items-center gap-2 min-w-0">
            <span className="size-2 shrink-0 rounded-full bg-danger" />
            <span className={`${compact ? "text-xs" : "text-sm"} min-w-0 flex-1 truncate`} title={issue.reason}>{issue.reason}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {fmtInt(issue.scrap)} · {fmtPct(issue.pctOfTotal, 1)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DeviationTopFiveCard({
  pillarKey,
  compact = false,
}: {
  pillarKey: DeviationPillarKey;
  compact?: boolean;
}) {
  const { data: dashboardData } = useDashboardData();
  const { data: processData = { processParts: [], processMachines: [], productParts: [], rows: [] } } =
    useProcessDeviationList();
  const { data: productData = { productParts: [], rows: [] } } = useProductDeviations();
  const reportingDate =
    dashboardData?.productionDate?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? yesterdayKey();
  const [hiddenKeys, setHiddenKeys] = useLocalState<string[]>(
    `amg:hidden-top-deviations:${pillarKey}:${reportingDate}`,
    [],
  );
  const rows = pillarKey === "D" ? processData.rows : productData.rows;
  const kind = pillarKey === "D" ? "process" : "product";
  const counts = new Map<
    string,
    {
      machine: string;
      part: string;
      count: number;
      deviationNumbers: Set<string>;
      descriptions: Set<string>;
      details: Set<string>;
    }
  >();

  for (const row of rows) {
    if (
      row.kind !== kind ||
      (pillarKey === "I" && row.closed) ||
      row.dateRequested !== reportingDate
    ) continue;
    let machine = row.machine;
    if (!machine && pillarKey === "I") {
      machine =
        dashboardData?.machineJobs?.find(
          (job) => job.partNumber.toUpperCase().replace(/\s+/g, "") === row.part,
        )?.machine ?? "";
    }
    if (pillarKey === "D" && !machine) continue;
    const displayMachine = machine
      ? machine.replace(/(IM|EM|AM)\d*$/i, "")
      : "Not assigned";
    const key = `${displayMachine}|${row.part || "No part"}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      if (row.deviationNumber) existing.deviationNumbers.add(row.deviationNumber);
      if (row.description) existing.descriptions.add(row.description);
      if (row.detail) existing.details.add(row.detail);
    }
    else {
      counts.set(key, {
        machine: displayMachine,
        part: row.part || "No part",
        count: 1,
        deviationNumbers: new Set(row.deviationNumber ? [row.deviationNumber] : []),
        descriptions: new Set(row.description ? [row.description] : []),
        details: new Set(row.detail ? [row.detail] : []),
      });
    }
  }

  const rankedDeviations = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.machine.localeCompare(b.machine));
  const itemKey = (item: { machine: string; part: string }) => `${item.machine}|${item.part}`;
  const hiddenCurrentCount = rankedDeviations.filter((item) => hiddenKeys.includes(itemKey(item))).length;
  const topFive = rankedDeviations
    .filter((item) => !hiddenKeys.includes(itemKey(item)))
    .slice(0, 5);
  const dismissDeviation = (item: { machine: string; part: string }) => {
    const key = itemKey(item);
    setHiddenKeys((current) => current.includes(key) ? current : [...current, key]);
  };
  const restoreDeviations = () => setHiddenKeys([]);
  const label = pillarKey === "D" ? "Top Process Deviations" : "Top Product Deviations";

  return (
    <section
      className={`rounded-sm border bg-card min-w-0 ${
        compact
          ? "border-border/60 p-4"
          : "border-border shadow-[var(--shadow-card)] border-t-2 border-t-primary p-6 lg:col-span-3"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={`font-bold uppercase tracking-wider text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
            {label}
          </h3>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Previous production date · {reportingDate}
            {pillarKey === "I" ? " · machine matched from buyoff data" : ""}
          </p>
        </div>
        {hiddenCurrentCount > 0 && (
          <button
            type="button"
            onClick={restoreDeviations}
            className="rounded-sm border border-border bg-card px-2 py-1 text-[10px] font-semibold text-primary hover:bg-secondary"
          >
            Restore hidden ({hiddenCurrentCount})
          </button>
        )}
      </div>
      {topFive.length ? (
        <ol className={compact ? "space-y-1.5" : "space-y-3"}>
          {topFive.map((item, index) => (
            <li
              key={`${item.machine}-${item.part}`}
              className={`relative min-w-0 rounded-sm bg-secondary/35 ${
                compact ? "flex items-center gap-2 px-2 py-1.5 text-[10px]" : "px-4 py-3 pr-12 text-xs"
              }`}
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {index + 1}
              </span>
              {compact ? (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">Machine {item.machine}</span>
                    <span className="block truncate text-muted-foreground">Part {item.part}</span>
                  </span>
                  {item.count > 1 && (
                    <span className="shrink-0 font-mono text-[9px] font-bold text-danger">×{item.count}</span>
                  )}
                </>
              ) : (
                <div className="mt-2 grid gap-3 sm:grid-cols-[11rem_13rem_1fr] sm:items-start">
                  <div>
                    <div className="font-bold text-foreground">Machine {item.machine}</div>
                    <div className="mt-1 text-muted-foreground">Part {item.part}</div>
                    {item.count > 1 && (
                      <div className="mt-1 font-mono text-[10px] font-bold text-danger">
                        {item.count} deviations
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Deviation
                    </div>
                    <div className="mt-1 font-semibold text-foreground">
                      {[...item.deviationNumbers].join(", ") || "Not provided"}
                    </div>
                    {[...item.descriptions].map((description) => (
                      <div key={description} className="mt-1 text-muted-foreground">
                        {description}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-sm border border-border/60 bg-card px-3 py-2">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Why / Details
                    </div>
                    {[...item.details].length ? (
                      <ul className="mt-1 space-y-1 text-foreground">
                        {[...item.details].map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-1 text-muted-foreground">No reason or notes were provided.</div>
                    )}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => dismissDeviation(item)}
                className={`${compact ? "static" : "absolute right-3 top-3"} grid size-6 shrink-0 place-items-center rounded-sm border border-border bg-card text-muted-foreground hover:border-danger/50 hover:text-danger`}
                aria-label={`Hide deviation for machine ${item.machine}, part ${item.part}`}
                title="Hide on this dashboard only"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">
          {hiddenCurrentCount
            ? "All deviations for this reporting date are hidden on this dashboard. Backend records were not changed."
            : "No deviations for this reporting date."}
        </p>
      )}
    </section>
  );
}

function TopIssuesCard({
  pillarKey,
  compact = false,
  title = "Top Issues",
  placeholder = "Add issue…",
}: {
  pillarKey: string;
  compact?: boolean;
  title?: string;
  placeholder?: string;
}) {
  const { tasks, isLoading, error, createTask, updateTask, deleteTask, isSaving } = useDashboardTasks();
  const issues = tasks.filter((t) => t.taskType === "Top Issues" && t.pillarKey === pillarKey && t.status !== "Complete");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [draft, setDraft] = useState("");
  const add = async () => {
    const v = draft.trim();
    if (!v) return;
    setDraft("");
    await createTask({ task: v, owner: "—", due: "", taskType: "Top Issues" }, pillarKey);
  };
  return (
    <section className={`group/card rounded-sm border bg-card min-w-0 ${compact ? "border-border/60 p-4" : "border-border shadow-[var(--shadow-card)] border-t-2 border-t-primary p-6"}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className={`font-bold uppercase tracking-wider text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>{title}</h3>
        {!compact && <span className="text-[10px] text-muted-foreground">{isSaving ? "Saving…" : "SharePoint synced"}</span>}
      </div>
      {error && <p className="mb-2 text-xs text-danger">{error instanceof Error ? error.message : "Top issues unavailable"}</p>}
      {isLoading && <p className="mb-2 text-xs text-muted-foreground">Loading issues…</p>}
      <ul className={`min-w-0 ${compact ? "thin-scrollbar max-h-[130px] space-y-1.5 overflow-y-auto pr-1" : "space-y-3"}`}>
        {issues.map((it) => (
          <li key={it.id} className="flex items-start gap-3 group/item min-w-0">
            <span className={`rounded-full bg-warning shrink-0 ${compact ? "mt-1.5 size-1.5" : "mt-2 size-2"}`} />
            <AutoTextarea
              value={drafts[it.id] ?? it.task}
              onChange={(v) => setDrafts((d) => ({ ...d, [it.id]: v }))}
              onCommit={(v) => {
                const trimmed = v.trim();
                if (trimmed && trimmed !== it.task) void updateTask(it.id, { task: trimmed });
                setDrafts((d) => {
                  const { [it.id]: _drop, ...rest } = d;
                  return rest;
                });
              }}
              compact={compact}
            />
            <button
              type="button"
              onClick={() => void updateTask(it.id, { status: "Complete" })}
              className="opacity-0 group-hover/item:opacity-40 hover:!opacity-100 text-xs text-muted-foreground hover:text-danger transition-opacity shrink-0"
              aria-label="Mark issue complete"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className={`mt-2 flex items-center gap-3 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity min-w-0 ${compact ? "text-xs" : "text-sm"}`}>
        <span className={`rounded-full bg-muted-foreground/40 shrink-0 ${compact ? "size-1.5" : "size-2"}`} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          placeholder={placeholder}
          className={`flex-1 bg-transparent outline-none border-b border-transparent focus:border-border/60 py-0.5 placeholder:text-muted-foreground/50 min-w-0 ${compact ? "text-xs" : "text-sm"}`}
        />
      </div>
    </section>
  );
}

function ActionItemsCard({ pillarKey }: { pillarKey: string; defaultItems: ActionItem[] }) {
  const { tasks, isLoading, error, createTask, updateTask, deleteTask, isSaving } = useDashboardTasks();
  const [draft, setDraft] = useState<{
    task: string;
    owner: string;
    due: string;
    taskType: DashboardTask["taskType"];
  }>({
    task: "",
    owner: "",
    due: "",
    taskType: "Escalation",
  });
  const add = async () => {
    if (!draft.task.trim()) return;
    await createTask({
      task: draft.task.trim(),
      owner: draft.owner.trim() || "—",
      due: draft.due,
      taskType: draft.taskType,
    }, pillarKey);
    setDraft((current) => ({ ...current, task: "", owner: "", due: "" }));
  };
  return (
    <section className="lg:col-span-2 group/card rounded-sm border border-border bg-card p-6 shadow-[var(--shadow-card)] border-t-2 border-t-primary">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Action Items</h3>
        <span className="text-[10px] text-muted-foreground">{isSaving ? "Saving…" : "SharePoint synced"}</span>
      </div>
      {error && <p className="mb-3 text-xs text-danger">{error instanceof Error ? error.message : "Task list unavailable"}</p>}
      {isLoading && <p className="mb-3 text-xs text-muted-foreground">Loading tasks…</p>}
      <ul className="space-y-3">
        {tasks.filter((task) => task.status !== "Complete").map((a) => (
          <li
            key={a.id}
            className={`flex flex-wrap items-center justify-between gap-3 text-sm rounded-lg px-4 py-3 group/item border ${
              a.status === "OverDue" ? "border-danger/50 bg-danger/10" : "border-transparent bg-secondary/40"
            }`}
          >
            <span className="shrink-0 rounded-full border border-border/60 bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {a.taskType ?? "Escalation"}
            </span>
            <input
              defaultValue={a.task}
              onBlur={(e) => {
                const task = e.target.value.trim();
                if (task && task !== a.task) void updateTask(a.id, { task });
              }}
              className="flex-1 bg-transparent outline-none border-b border-transparent focus:border-border/60 py-0.5"
            />
            <span className="shrink-0 rounded-full bg-card border border-border/60 px-3 py-1 text-xs text-muted-foreground flex items-center gap-1">
              <input
                defaultValue={a.owner}
                onBlur={(e) => {
                  const owner = e.target.value.trim() || "—";
                  if (owner !== a.owner) void updateTask(a.id, { owner });
                }}
                className="w-20 bg-transparent outline-none focus:border-b focus:border-border/60 text-center"
              />
              <span>·</span>
              <input
                type="date"
                defaultValue={a.due}
                onBlur={(e) => {
                  if (e.target.value !== a.due) void updateTask(a.id, { due: e.target.value });
                }}
                className="w-32 bg-transparent outline-none focus:border-b focus:border-border/60 text-center"
              />
            </span>
            <select
              value={a.status}
              onChange={(e) => void updateTask(a.id, { status: e.target.value as DashboardTask["status"] })}
              aria-label={`Status for ${a.task}`}
              className={`rounded-full border px-2 py-1 text-xs font-semibold outline-none ${
                a.status === "OverDue"
                  ? "border-danger/50 bg-danger/10 text-danger"
                  : "border-border/60 bg-card text-success"
              }`}
            >
              <option value="Open">Open</option>
              <option value="OverDue">Overdue</option>
              <option value="Complete">Complete</option>
            </select>
            <button
              type="button"
              onClick={() => void updateTask(a.id, { status: a.status === "OverDue" ? "Open" : "OverDue" })}
              aria-pressed={a.status === "OverDue"}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                a.status === "OverDue"
                  ? "border-danger bg-danger text-danger-foreground"
                  : "border-border/60 bg-card text-muted-foreground hover:border-danger/50 hover:text-danger"
              }`}
            >
              {a.status === "OverDue" ? "Mark Open" : "Flag overdue"}
            </button>
            <button
              type="button"
              onClick={() => void updateTask(a.id, { status: "Complete" })}
              className="opacity-0 group-hover/item:opacity-40 hover:!opacity-100 text-xs text-muted-foreground hover:text-danger transition-opacity"
              aria-label="Mark action complete"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm px-4 py-2 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity">
        <select
          value={draft.taskType}
          onChange={(e) => setDraft((d) => ({ ...d, taskType: e.target.value as DashboardTask["taskType"] }))}
          aria-label="Task type"
          className="shrink-0 rounded-md border border-border/60 bg-card px-2 py-1 text-xs text-muted-foreground outline-none focus:border-primary"
        >
          <option value="Escalation">Current Escalation</option>
          <option value="LongTermAction">Long-Term Action</option>
        </select>
        <input
          value={draft.task}
          onChange={(e) => setDraft((d) => ({ ...d, task: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
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
            type="date"
            aria-label="Due date"
            className="w-32 bg-transparent outline-none border-b border-transparent focus:border-border/60 text-center placeholder:text-muted-foreground/50"
          />
        </span>
      </div>
    </section>
  );
}

function FollowUpTasksCard({
  title,
  taskType,
}: {
  title: string;
  taskType: DashboardTask["taskType"];
}) {
  const { tasks, isLoading, error, createTask, updateTask, deleteTask, uploadPartImage, isSaving } = useDashboardTasks();
  const priorityLimit = taskType === "LongTermAction" ? 10 : 5;
  const [draft, setDraft] = useState({
    task: "",
    owner: "",
    due: "",
    priority: taskType === "LongTermAction" ? 5 : 3,
  });
  const [showAll, setShowAll] = useState(false);
  const [taskIndex, setTaskIndex] = useState(0);
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const visible = tasks
    .filter((task) => task.taskType === taskType && task.status !== "Complete")
    .sort((a, b) => a.priority - b.priority || b.id - a.id);
  const currentTask = visible.length > 0 ? visible[taskIndex % visible.length] : undefined;
  const detailTask = detailTaskId == null
    ? undefined
    : tasks.find((task) => task.id === detailTaskId);
  const showNextTask = () => {
    if (visible.length > 1) setTaskIndex((index) => (index + 1) % visible.length);
  };
  const showPreviousTask = () => {
    if (visible.length > 1) {
      setTaskIndex((index) => (index - 1 + visible.length) % visible.length);
    }
  };
  useEffect(() => {
    if (taskIndex >= visible.length) setTaskIndex(Math.max(visible.length - 1, 0));
  }, [taskIndex, visible.length]);
  useEffect(() => {
    if (!showAll) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowAll(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAll]);
  const add = async () => {
    const task = draft.task.trim();
    if (!task) return;
    await createTask({
      task,
      owner: draft.owner.trim() || "—",
      due: draft.due,
      taskType,
      priority: draft.priority,
    }, "FollowUp");
    setDraft((current) => ({ ...current, task: "", owner: "", due: "" }));
  };

  return (
    <section
      className="rounded-sm border border-border bg-card p-4 shadow-[var(--shadow-card)] border-t-2 border-t-primary cursor-pointer"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, input, select, label")) return;
        showNextTask();
      }}
      title={visible.length > 1 ? "Click to show the next task" : undefined}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {isSaving
              ? "Saving…"
              : visible.length
                ? `${(taskIndex % visible.length) + 1} / ${visible.length}`
                : "0 tasks"}
          </span>
          {visible.length > 1 && (
            <div className="flex overflow-hidden rounded-sm border border-border bg-background">
              <button
                type="button"
                onClick={showPreviousTask}
                className="px-2 py-1 text-[10px] font-bold text-muted-foreground hover:bg-secondary hover:text-primary"
                aria-label={`Previous ${title} task`}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={showNextTask}
                className="border-l border-border px-2 py-1 text-[10px] font-bold text-muted-foreground hover:bg-secondary hover:text-primary"
                aria-label={`Next ${title} task`}
              >
                ›
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="rounded-sm border border-border bg-background px-2 py-1 text-[10px] font-semibold text-primary hover:bg-secondary"
          >
            View all
          </button>
        </div>
      </div>
      {error && <p className="mb-2 text-xs text-danger">{error instanceof Error ? error.message : "Tasks unavailable"}</p>}
      {isLoading && <p className="mb-2 text-xs text-muted-foreground">Loading tasks…</p>}
      <ul className="space-y-2">
        {currentTask && (
          <li key={currentTask.id} className={`rounded-sm border p-3 ${currentTask.status === "OverDue" ? "border-danger/50 bg-danger/10" : "border-border/60 bg-secondary/30"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDetailTaskId(currentTask.id)}
                className="min-w-0 flex-1 text-left text-sm font-medium underline-offset-4 hover:text-primary hover:underline"
                title="Open full task details"
              >
                {currentTask.task}
              </button>
              <button
                type="button"
                onClick={() => void updateTask(currentTask.id, { status: currentTask.status === "OverDue" ? "Open" : "OverDue" })}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${currentTask.status === "OverDue" ? "border-danger bg-danger text-danger-foreground" : "border-border bg-card text-muted-foreground hover:text-danger"}`}
              >
                {currentTask.status === "OverDue" ? "Mark Open" : "Flag overdue"}
              </button>
              <button type="button" onClick={() => void deleteTask(currentTask.id)} className="text-xs text-muted-foreground hover:text-danger" aria-label={`Complete ${currentTask.task}`}>✕</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
              <label className="rounded-full bg-warning/15 px-2 py-0.5 font-semibold text-warning-foreground">
                Priority:{" "}
                <select
                  value={currentTask.priority}
                  onChange={(e) =>
                    void updateTask(currentTask.id, { priority: Number(e.target.value) })
                  }
                  aria-label={`Priority for ${currentTask.task}`}
                  className="bg-transparent font-semibold outline-none"
                >
                  {Array.from({ length: priorityLimit }, (_, index) => index + 1).map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
              <label className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                Type:{" "}
                <select
                  value={currentTask.taskType}
                  onChange={(e) => void updateTask(currentTask.id, { taskType: e.target.value as DashboardTask["taskType"] })}
                  aria-label={`Task type for ${currentTask.task}`}
                  className="bg-transparent font-semibold outline-none"
                >
                  <option value="Escalation">Current Escalation</option>
                  <option value="LongTermAction">Long-Term Action</option>
                </select>
              </label>
              <label className={`rounded-full px-2 py-0.5 font-semibold ${currentTask.status === "OverDue" ? "bg-danger/15 text-danger" : "bg-success/15 text-success"}`}>
                Status:{" "}
                <select
                  value={currentTask.status}
                  onChange={(e) => void updateTask(currentTask.id, { status: e.target.value as DashboardTask["status"] })}
                  aria-label={`Status for ${currentTask.task}`}
                  className="bg-transparent font-semibold outline-none"
                >
                  <option value="Open">Open</option>
                  <option value="OverDue">Overdue</option>
                  <option value="Complete">Complete</option>
                </select>
              </label>
              <span>Owner: {currentTask.owner}</span>
              <label className="inline-flex items-center gap-1">
                Due:
                <input
                  type="date"
                  value={currentTask.due}
                  onChange={(e) => void updateTask(currentTask.id, { due: e.target.value })}
                  aria-label={`Due date for ${currentTask.task}`}
                  className="rounded-sm border border-border/60 bg-card px-1 py-0.5 text-[10px] outline-none focus:border-primary"
                />
              </label>
            </div>
          </li>
        )}
      </ul>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_9rem_6rem_auto]">
        <input value={draft.task} onChange={(e) => setDraft((d) => ({ ...d, task: e.target.value }))} placeholder={`Add ${title.toLowerCase()}…`} className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary" />
        <input value={draft.owner} onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))} placeholder="Owner" className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary" />
        <input type="date" value={draft.due} onChange={(e) => setDraft((d) => ({ ...d, due: e.target.value }))} aria-label="Due date" className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary" />
        <select
          value={draft.priority}
          onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) }))}
          aria-label={`Priority for new ${title}`}
          className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
        >
          {Array.from({ length: priorityLimit }, (_, index) => index + 1).map((level) => (
            <option key={level} value={level}>Priority {level}</option>
          ))}
        </select>
        <button type="button" onClick={() => void add()} disabled={!draft.task.trim() || isSaving} className="rounded-sm bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Add</button>
      </div>
      {showAll && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-background/75 p-4 backdrop-blur-md animate-fade-in cursor-default"
          onClick={() => setShowAll(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`All ${title}`}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-sm border border-border bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-border bg-secondary/30 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">{title}</h2>
                <p className="text-xs text-muted-foreground">
                  {visible.length} active SharePoint task{visible.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="grid size-9 place-items-center rounded-sm border border-border bg-card hover:bg-secondary"
                aria-label={`Close ${title}`}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="thin-scrollbar flex-1 overflow-y-auto p-5">
              {visible.length === 0 ? (
                <div className="rounded-sm border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  No active {title.toLowerCase()}.
                </div>
              ) : (
                <div className="space-y-3">
                  {visible.map((task) => (
                    <div
                      key={task.id}
                      className={`rounded-sm border p-4 ${
                        task.status === "OverDue"
                          ? "border-danger/50 bg-danger/10"
                          : "border-border bg-secondary/20"
                      }`}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <input
                          defaultValue={task.task}
                          onBlur={(event) => {
                            const value = event.target.value.trim();
                            if (value && value !== task.task) void updateTask(task.id, { task: value });
                          }}
                          className="min-w-[16rem] flex-1 border-b border-transparent bg-transparent text-sm font-semibold outline-none focus:border-primary"
                          aria-label={`Task description for ${task.task}`}
                        />
                        <select
                          value={task.status}
                          onChange={(event) =>
                            void updateTask(task.id, {
                              status: event.target.value as DashboardTask["status"],
                            })
                          }
                          className={`rounded-full border px-3 py-1 text-xs font-semibold outline-none ${
                            task.status === "OverDue"
                              ? "border-danger/50 bg-danger/10 text-danger"
                              : "border-border bg-card text-success"
                          }`}
                          aria-label={`Status for ${task.task}`}
                        >
                          <option value="Open">Open</option>
                          <option value="OverDue">Overdue</option>
                          <option value="Complete">Complete</option>
                        </select>
                        <label className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                          Priority
                          <select
                            value={task.priority}
                            onChange={(event) =>
                              void updateTask(task.id, {
                                priority: Number(event.target.value),
                              })
                            }
                            aria-label={`Priority for ${task.task}`}
                            className="bg-transparent font-semibold text-foreground outline-none"
                          >
                            {Array.from({ length: priorityLimit }, (_, index) => index + 1).map((level) => (
                              <option key={level} value={level}>{level}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => setDetailTaskId(task.id)}
                          className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          Open details
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-[1fr_11rem_auto_auto] sm:items-end">
                        <label className="text-muted-foreground">
                          Owner
                          <input
                            defaultValue={task.owner}
                            onBlur={(event) => {
                              const owner = event.target.value.trim() || "—";
                              if (owner !== task.owner) void updateTask(task.id, { owner });
                            }}
                            className="mt-1 block w-full rounded-sm border border-border bg-card px-2 py-1.5 text-foreground outline-none focus:border-primary"
                          />
                        </label>
                        <label className="text-muted-foreground">
                          Due date
                          <input
                            type="date"
                            value={task.due}
                            onChange={(event) => void updateTask(task.id, { due: event.target.value })}
                            className="mt-1 block w-full rounded-sm border border-border bg-card px-2 py-1.5 text-foreground outline-none focus:border-primary"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            void updateTask(task.id, {
                              status: task.status === "OverDue" ? "Open" : "OverDue",
                            })
                          }
                          className={`rounded-sm border px-3 py-1.5 text-xs font-semibold ${
                            task.status === "OverDue"
                              ? "border-danger bg-danger text-danger-foreground"
                              : "border-border bg-card text-muted-foreground hover:text-danger"
                          }`}
                        >
                          {task.status === "OverDue" ? "Mark Open" : "Flag overdue"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteTask(task.id)}
                          className="rounded-sm border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-success/50 hover:text-success"
                        >
                          Mark complete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {detailTask && (
        <TaskDetailModal
          key={detailTask.id}
          task={detailTask}
          priorityLimit={detailTask.taskType === "LongTermAction" ? 10 : 5}
          isSaving={isSaving}
          onSave={async (patch, partImageFile) => {
            const saved = await updateTask(detailTask.id, patch);
            if (partImageFile) await uploadPartImage(detailTask.id, partImageFile);
            return saved;
          }}
          onClose={() => setDetailTaskId(null)}
        />
      )}
    </section>
  );
}

function TaskDetailModal({
  task,
  priorityLimit,
  isSaving,
  onSave,
  onClose,
}: {
  task: DashboardTask;
  priorityLimit: number;
  isSaving: boolean;
  onSave: (patch: Partial<DashboardTask>, partImageFile?: File) => Promise<unknown>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(task);
  const [saveError, setSaveError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [partImageFile, setPartImageFile] = useState<File | null>(null);
  const [partImagePreview, setPartImagePreview] = useState(task.partImage);

  useEffect(() => {
    if (!partImageFile) {
      setPartImagePreview(task.partImage);
      return;
    }
    const objectUrl = URL.createObjectURL(partImageFile);
    setPartImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [partImageFile, task.partImage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError("");
    try {
      await onSave({
        task: draft.task.trim() || "Untitled task",
        owner: draft.owner.trim() || "—",
        due: draft.due,
        priority: draft.priority,
        status: draft.status,
        problemStatement: draft.problemStatement.trim(),
        rootCause: draft.rootCause.trim(),
        countermeasure: draft.countermeasure.trim(),
        affectedPartNumber: draft.affectedPartNumber.trim(),
        partDescription: draft.partDescription.trim(),
        machine: draft.machine.trim(),
        completedDate: draft.status === "Complete" ? draft.completedDate : "",
      }, partImageFile ?? undefined);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save task details");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/75 p-4 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Task details for ${task.task}`}
    >
      <form
        onSubmit={(event) => void save(event)}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-sm border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border bg-secondary/30 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {task.taskType === "LongTermAction" ? "Long-Term Action" : "Open Escalation"} · Task #{task.id}
            </div>
            <input
              value={draft.task}
              onChange={(event) => setDraft((current) => ({ ...current, task: event.target.value }))}
              className="mt-1 w-full border-b border-transparent bg-transparent text-xl font-bold outline-none focus:border-primary"
              aria-label="Task title"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-sm border border-border bg-card hover:bg-secondary"
            aria-label="Close task details"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="thin-scrollbar flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
            <div className="space-y-4">
              <TaskDetailTextArea
                label="Problem Statement"
                value={draft.problemStatement}
                onChange={(problemStatement) => setDraft((current) => ({ ...current, problemStatement }))}
                placeholder="Describe the problem, expected condition, and actual condition."
              />
              <TaskDetailTextArea
                label="Root Cause"
                value={draft.rootCause}
                onChange={(rootCause) => setDraft((current) => ({ ...current, rootCause }))}
                placeholder="Document the verified root cause."
              />
              <TaskDetailTextArea
                label="Countermeasure"
                value={draft.countermeasure}
                onChange={(countermeasure) => setDraft((current) => ({ ...current, countermeasure }))}
                placeholder="Describe the corrective action and how recurrence will be prevented."
              />
              <TaskDetailTextArea
                label="Part Description"
                value={draft.partDescription}
                onChange={(partDescription) => setDraft((current) => ({ ...current, partDescription }))}
                placeholder="Describe the affected part."
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <TaskDetailField
                  label="Status"
                  value={draft.status}
                  asSelect
                  options={["Open", "OverDue", "Complete"]}
                  onChange={(status) =>
                    setDraft((current) => ({
                      ...current,
                      status: status as DashboardTask["status"],
                      completedDate:
                        status === "Complete"
                          ? current.completedDate || new Date().toISOString().slice(0, 10)
                          : "",
                    }))
                  }
                />
                <TaskDetailField
                  label="Priority"
                  value={String(draft.priority)}
                  asSelect
                  options={Array.from({ length: priorityLimit }, (_, index) => String(index + 1))}
                  onChange={(priority) => setDraft((current) => ({ ...current, priority: Number(priority) }))}
                />
              </div>
              <TaskDetailField
                label="Assigned To"
                value={draft.owner}
                onChange={(owner) => setDraft((current) => ({ ...current, owner }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <TaskDetailField
                  label="Due Date"
                  value={draft.due}
                  type="date"
                  onChange={(due) => setDraft((current) => ({ ...current, due }))}
                />
                <TaskDetailField
                  label="Completed Date"
                  value={draft.completedDate}
                  type="date"
                  disabled={draft.status !== "Complete"}
                  onChange={(completedDate) => setDraft((current) => ({ ...current, completedDate }))}
                />
              </div>
              <TaskDetailField
                label="Machine"
                value={draft.machine}
                onChange={(machine) => setDraft((current) => ({ ...current, machine }))}
                placeholder="Machine number"
              />
              <TaskDetailField
                label="Affected Part Number"
                value={draft.affectedPartNumber}
                onChange={(affectedPartNumber) => setDraft((current) => ({ ...current, affectedPartNumber }))}
              />
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Part Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setImageFailed(false);
                    setPartImageFile(file);
                  }}
                  className="mt-1.5 block w-full rounded-sm border border-border bg-background px-2 py-2 text-xs font-normal normal-case tracking-normal text-foreground file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
                />
                <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal">
                  Choose a photo or use the camera option on a mobile device.
                </span>
              </label>
              <div className="overflow-hidden rounded-sm border border-border bg-secondary/20">
                {partImagePreview && !imageFailed ? (
                  <img
                    src={partImagePreview}
                    alt={draft.partDescription || `Part ${draft.affectedPartNumber}`}
                    className="h-48 w-full object-contain bg-white"
                    onError={() => setImageFailed(true)}
                  />
                ) : (
                  <div className="grid h-32 place-items-center px-4 text-center text-xs text-muted-foreground">
                    {imageFailed ? "The saved image could not be displayed." : "Choose an image to preview it here."}
                  </div>
                )}
              </div>
              <div className="rounded-sm border border-border bg-secondary/20 p-3 text-[11px] text-muted-foreground">
                Created: {task.createdAt ? new Date(task.createdAt).toLocaleDateString("en-US") : "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-secondary/20 px-5 py-4">
          <p className="text-xs text-danger">{saveError}</p>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-sm bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save to SharePoint"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function TaskDetailField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
  asSelect,
  options = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  asSelect?: boolean;
  options?: string[];
}) {
  const controlClass =
    "mt-1 w-full rounded-sm border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
      {asSelect ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} className={controlClass}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option === "OverDue" ? "Overdue" : option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={controlClass}
        />
      )}
    </label>
  );
}

function TaskDetailTextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-1 w-full resize-y rounded-sm border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}

/** Maps the weather service's WMO-style code to a representative icon. */
function weatherIcon(code: number) {
  if (code === 0) return Sun;
  if (code <= 3) return CloudSun;
  if (code === 45 || code === 48) return CloudFog;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

function WeatherBadge() {
  const { data: weather } = useDashboardWeather();
  if (!weather) return null;
  const Icon = weatherIcon(weather.code);
  return (
    <div
      className="hidden shrink-0 items-center gap-2 rounded-sm border border-white/20 bg-white/10 px-2.5 py-1.5 lg:flex"
      title={`${weather.label}${weather.updatedAt ? ` · Updated ${new Date(weather.updatedAt).toLocaleTimeString()}` : ""}`}
    >
      <Icon className="size-5 shrink-0 text-[#9ec5ff]" />
      <div className="leading-tight">
        <div className="text-sm font-bold tabular-nums text-white">{weather.tempF}°F</div>
        <div className="text-[10px] text-white/65">{weather.city}</div>
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

/**
 * A real factory stack light (the red/amber/green tower lamp bolted to
 * machines on the floor), rendered as today's live status for this pillar.
 * Only the current segment lights up — the other two stay dim, exactly like
 * the physical fixture — and the red segment pulses because a real andon
 * light does too.
 */
function StackLight({ status }: { status: Status }) {
  const label = status === "ok" ? "OK" : status === "warn" ? "Warning" : status === "fail" ? "Miss" : "Not recorded";
  return (
    <div
      className="flex flex-col items-center gap-[3px] rounded-sm border border-border bg-secondary/50 px-1.5 py-1.5"
      title={`Today's live status: ${label}`}
      aria-label={`Today's live status: ${label}`}
    >
      <span className={`size-2 rounded-full transition-all ${status === "fail" ? "stack-light-fail bg-danger" : "bg-danger/15"}`} />
      <span className={`size-2 rounded-full transition-all ${status === "warn" ? "bg-warning shadow-[0_0_7px_var(--warning)]" : "bg-warning/15"}`} />
      <span className={`size-2 rounded-full transition-all ${status === "ok" ? "bg-success shadow-[0_0_7px_var(--success)]" : "bg-success/15"}`} />
    </div>
  );
}

function NotesCard({
  ...args
}: Parameters<typeof NotesCardImpl>[0]) {
  return <NotesCardImpl {...args} />;
}

const OPEN_ESCALATIONS_KEY = "notes:open-escalations";
const OPEN_ESCALATIONS_DEFAULT = [
  "Mold lockers not being returned",
  "PVL/LPVL grinder blades damaged by metal tools",
];

function useNotesItems(storageKey: string, defaultItems: string[]) {
  const [items, setItems] = useState<string[]>(defaultItems);
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) setItems(JSON.parse(raw));
        else setItems(defaultItems);
      } catch {}
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) read();
    };
    const onCustom = () => read();
    window.addEventListener("storage", onStorage);
    window.addEventListener(`notes-updated:${storageKey}`, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(`notes-updated:${storageKey}`, onCustom);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  return items;
}

function OpenEscalationsStat() {
  const { tasks, isLoading, error } = useDashboardTasks();
  const escalations = tasks.filter((task) => task.taskType === "Escalation" && task.status !== "Complete");
  const count = escalations.length;
  const preview = error
    ? "SharePoint tasks unavailable"
    : isLoading
      ? "Loading SharePoint tasks…"
      : escalations[0]?.task ?? "No open escalations";
  return (
    <StatCard
      label="Open Escalations"
      value={String(count)}
      sub={count === 0 ? "All clear" : preview}
      icon={AlertTriangle}
      tone={count === 0 ? "ok" : "warn"}
    />
  );
}

function NotesCardImpl({
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
      window.dispatchEvent(new Event(`notes-updated:${storageKey}`));
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
            className="rounded-sm border border-border bg-card p-4 shadow-[var(--shadow-card)]"
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
