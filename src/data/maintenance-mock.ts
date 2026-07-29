import { useEffect, useState } from "react";
import { KNOWN_MACHINE_IDS } from "@/lib/intouch-layout";

// Deterministic PRNG so mock data feels stable per machine
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619;
  return h >>> 0;
}
function rand(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export type MachineStatus = "run" | "idle" | "warn" | "down";
export type MachineTelemetry = {
  id: string;
  status: MachineStatus;
  uptimePct: number;
  cycleSec: number;
  tempC: number;
  pressBar: number;
  vibration: number; // 0-1
  shots: number;
  waveform: number[]; // 32 samples 0..1
};

const MACHINES = Array.from(KNOWN_MACHINE_IDS);

function makeWave(seed: number, phase: number, amp: number): number[] {
  const r = rand(seed);
  const out: number[] = [];
  for (let i = 0; i < 32; i++) {
    const t = (i / 32) * Math.PI * 4 + phase;
    const spike = i === (Math.floor(phase * 3) % 32) ? 0.35 : 0;
    out.push(0.5 + Math.sin(t) * 0.22 * amp + (r() - 0.5) * 0.08 + spike);
  }
  return out;
}

export function buildFleet(tick: number): MachineTelemetry[] {
  return MACHINES.map((id, i) => {
    const seed = hash(id);
    const r = rand(seed + Math.floor(tick / 20));
    const roll = r();
    let status: MachineStatus =
      roll < 0.08 ? "down" : roll < 0.18 ? "warn" : roll < 0.26 ? "idle" : "run";
    const amp = status === "run" ? 1 : status === "warn" ? 1.6 : status === "down" ? 0.15 : 0.4;
    return {
      id,
      status,
      uptimePct: Math.round(70 + rand(seed)() * 29 * 10) / 10,
      cycleSec: Math.round((18 + rand(seed + 1)() * 22) * 10) / 10,
      tempC: Math.round(180 + rand(seed + 2)() * 60),
      pressBar: Math.round(80 + rand(seed + 3)() * 60),
      vibration: Math.round(rand(seed + 4)() * 100) / 100,
      shots: 1200 + Math.floor(rand(seed + 5)() * 4800) + (tick % 1000) + i * 7,
      waveform: makeWave(seed, tick * 0.12 + i, amp),
    };
  });
}

export type Alert = {
  id: string;
  ts: number;
  machine: string;
  severity: "info" | "warn" | "crit";
  msg: string;
};

const ALERT_MSGS = [
  { s: "crit" as const, m: "Hydraulic pressure drop" },
  { s: "crit" as const, m: "Emergency stop triggered" },
  { s: "warn" as const, m: "Barrel temp above setpoint" },
  { s: "warn" as const, m: "Vibration Z-axis exceeded" },
  { s: "warn" as const, m: "Cycle time drift +8%" },
  { s: "info" as const, m: "Cavity purge complete" },
  { s: "info" as const, m: "Preventive maintenance due in 48h" },
  { s: "warn" as const, m: "Cooling water flow low" },
  { s: "crit" as const, m: "Screw torque spike detected" },
  { s: "info" as const, m: "Operator handoff logged" },
];

export function buildAlerts(tick: number, count = 12): Alert[] {
  const r = rand(1234 + Math.floor(tick / 3));
  const out: Alert[] = [];
  for (let i = 0; i < count; i++) {
    const machine = MACHINES[Math.floor(r() * MACHINES.length)];
    const pick = ALERT_MSGS[Math.floor(r() * ALERT_MSGS.length)];
    out.push({
      id: `${tick}-${i}`,
      ts: Date.now() - i * 47_000 - Math.floor(r() * 20_000),
      machine,
      severity: pick.s,
      msg: pick.m,
    });
  }
  return out;
}

export type WorkOrder = {
  id: string;
  machine: string;
  title: string;
  priority: "P1" | "P2" | "P3";
  tech: string;
  status: "open" | "progress" | "done";
  eta: string;
};

const WO_TITLES = [
  "Replace hydraulic filter",
  "Recalibrate ejector",
  "Rebuild barrel heater",
  "Swap thermocouple",
  "Grease slide rails",
  "Nozzle tip replacement",
  "Chiller loop flush",
  "PLC firmware update",
  "Robot gripper alignment",
  "Mold clamp inspection",
];
const TECHS = ["J. Ortiz", "M. Chen", "R. Patel", "S. Nguyen", "K. Ivanov", "D. Rossi"];

export function buildWorkOrders(tick: number): WorkOrder[] {
  const r = rand(9182 + Math.floor(tick / 30));
  return Array.from({ length: 14 }).map((_, i) => {
    const roll = r();
    const status: WorkOrder["status"] = roll < 0.4 ? "open" : roll < 0.75 ? "progress" : "done";
    const p = r();
    return {
      id: `WO-${4200 + i}`,
      machine: MACHINES[Math.floor(r() * MACHINES.length)],
      title: WO_TITLES[Math.floor(r() * WO_TITLES.length)],
      priority: p < 0.2 ? "P1" : p < 0.55 ? "P2" : "P3",
      tech: TECHS[Math.floor(r() * TECHS.length)],
      status,
      eta: `${Math.floor(r() * 8) + 1}h`,
    };
  });
}

export type DowntimeReason = { reason: string; minutes: number };
export function buildDowntime(tick: number): DowntimeReason[] {
  const r = rand(5511 + Math.floor(tick / 8));
  const base = [
    "Mold change",
    "Material feed",
    "Hydraulic fault",
    "Operator break",
    "Robot fault",
    "Cooling issue",
    "Quality hold",
    "Power dip",
  ];
  return base
    .map((reason) => ({ reason, minutes: Math.round(20 + r() * 260) }))
    .sort((a, b) => b.minutes - a.minutes);
}

export type Spare = { part: string; sku: string; onHand: number; min: number };
export function buildSpares(): Spare[] {
  return [
    { part: "Hydraulic filter 10µ", sku: "HF-010", onHand: 3, min: 6 },
    { part: "Thermocouple K-type", sku: "TC-K12", onHand: 12, min: 8 },
    { part: "Nozzle tip Ø4", sku: "NZ-004", onHand: 1, min: 4 },
    { part: "Barrel heater band", sku: "BH-220", onHand: 7, min: 5 },
    { part: "Servo drive fuse", sku: "SF-32A", onHand: 0, min: 10 },
    { part: "Ejector O-ring kit", sku: "OR-KIT", onHand: 22, min: 10 },
    { part: "Cooling hose 1/2\"", sku: "CH-050", onHand: 5, min: 8 },
    { part: "Robot gripper pad", sku: "RG-PAD", onHand: 9, min: 6 },
  ];
}

export type PmTask = { day: number; machine: string; task: string; hours: number };
export function buildPm(): PmTask[] {
  const r = rand(7777);
  return Array.from({ length: 22 }).map(() => ({
    day: Math.floor(r() * 14),
    machine: MACHINES[Math.floor(r() * MACHINES.length)],
    task: WO_TITLES[Math.floor(r() * WO_TITLES.length)],
    hours: Math.max(1, Math.floor(r() * 6)),
  }));
}

/** Ticking hook that increments ~4x per second — cheap, drives all mocked data. */
export function useTick(intervalMs = 250): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
}