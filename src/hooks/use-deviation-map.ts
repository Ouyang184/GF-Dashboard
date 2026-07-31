import { useSyncExternalStore } from "react";

export type PillarKey = "D" | "I";

/** Each flagged machine stores the YYYY-MM-DD it was flagged on. */
type State = Record<PillarKey, Record<string, string>>;

const STORAGE_KEY = "amg:deviation-map:v2";

function load(): State {
  if (typeof window === "undefined") return { D: {}, I: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { D: {}, I: {} };
    const parsed = JSON.parse(raw) as Partial<State>;
    return { D: parsed.D ?? {}, I: parsed.I ?? {} };
  } catch {
    return { D: {}, I: {} };
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function emit() {
  persist();
  for (const l of listeners) l();
}

function todayKey(): string {
  return dayKey(new Date());
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** YYYY-MM-DD for the calendar day before today. */
export function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

/** YYYY-MM-DD for the previous scheduled production day (Monday looks back to Friday). */
export function previousProductionDayKey(reference: Date = new Date()): string {
  const d = new Date(reference);
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return dayKey(d);
}

export function toggleDeviation(pillar: PillarKey, id: string) {
  const cur = state[pillar][id];
  const next = { ...state[pillar] };
  if (cur) delete next[id];
  else next[id] = todayKey();
  state = { ...state, [pillar]: next };
  emit();
}

/**
 * Clears only today's flagged machines (the interactive board), by default —
 * older days stay in storage so they remain visible via useDeviationsOnDate.
 * Pass a specific day to clear that day instead.
 */
export function clearDeviations(pillar: PillarKey, day: string = todayKey()) {
  const next = { ...state[pillar] };
  for (const [id, flaggedOn] of Object.entries(next)) {
    if (flaggedOn === day) delete next[id];
  }
  state = { ...state, [pillar]: next };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return state;
}
function getServerSnapshot() {
  return state;
}

/** All flagged machines for a pillar across every stored day (manual flags only). */
export function useDeviationMap(pillar: PillarKey) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return s[pillar];
}

/** Manually-flagged machines for a pillar, filtered to today only — what the interactive board should show. */
export function useDeviationMapToday(pillar: PillarKey): Record<string, string> {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const today = todayKey();
  return Object.fromEntries(Object.entries(s[pillar]).filter(([, day]) => day === today));
}

export function useDeviationCountFor(pillar: PillarKey) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return Object.keys(s[pillar]).length;
}

/** Count of machines flagged specifically on the given YYYY-MM-DD day. */
export function useDeviationCountOnDate(pillar: PillarKey, day: string) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  let n = 0;
  for (const flaggedOn of Object.values(s[pillar])) {
    if (flaggedOn === day) n++;
  }
  return n;
}

/** Machine IDs manually flagged on the given YYYY-MM-DD day — used to look back at a past day. */
export function useDeviationsOnDate(pillar: PillarKey, day: string): string[] {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return Object.entries(s[pillar])
    .filter(([, flaggedOn]) => flaggedOn === day)
    .map(([id]) => id);
}
