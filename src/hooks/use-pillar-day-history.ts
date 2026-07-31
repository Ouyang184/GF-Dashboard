import { useSyncExternalStore } from "react";

export type DayHistoryPillarKey = "S" | "Q" | "D" | "I" | "P";
export type DayStatus = "ok" | "warn" | "fail";

type State = Record<DayHistoryPillarKey, Record<string, DayStatus>>;

const STORAGE_KEY = "amg:pillar-day-history:v1";
const EMPTY: State = { S: {}, Q: {}, D: {}, I: {}, P: {} };

function load(): State {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      S: parsed.S ?? {},
      Q: parsed.Q ?? {},
      D: parsed.D ?? {},
      I: parsed.I ?? {},
      P: parsed.P ?? {},
    };
  } catch {
    return EMPTY;
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

/** YYYY-MM-DD in local time, used as the day key everywhere in this store. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Record the real, observed status for a pillar on a given day. Call this
 * only with a status derived from live data (or a genuine manual entry) —
 * never a placeholder — since once written it becomes that day's permanent
 * history.
 */
export function recordPillarDay(pillar: DayHistoryPillarKey, day: string, status: DayStatus) {
  if (state[pillar][day] === status) return;
  state = { ...state, [pillar]: { ...state[pillar], [day]: status } };
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

/** Reactive read of every day recorded so far for a pillar (date key -> status). */
export function usePillarDayHistory(pillar: DayHistoryPillarKey): Record<string, DayStatus> {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return s[pillar];
}
