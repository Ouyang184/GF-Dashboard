import { useSyncExternalStore } from "react";

export type PillarKey = "D" | "I";

type State = Record<PillarKey, Record<string, boolean>>;

const STORAGE_KEY = "amg:deviation-map:v1";

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

export function toggleDeviation(pillar: PillarKey, id: string) {
  const cur = state[pillar][id];
  const next = { ...state[pillar] };
  if (cur) delete next[id];
  else next[id] = true;
  state = { ...state, [pillar]: next };
  emit();
}

export function clearDeviations(pillar: PillarKey) {
  state = { ...state, [pillar]: {} };
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

export function useDeviationMap(pillar: PillarKey) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return s[pillar];
}

export function useDeviationCountFor(pillar: PillarKey) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return Object.keys(s[pillar]).length;
}
