import { useSyncExternalStore } from "react";

export type FloorStatus = "ok" | "warn" | "fail" | "qc" | "na";

let state: Record<string, FloorStatus> = {};
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setFloorOverride(id: string, status: FloorStatus) {
  state = { ...state, [id]: status };
  emit();
}

export function clearFloorOverrides() {
  state = {};
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

export function useFloorOverrides() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Count of tiles currently flagged as a deviation (warn/fail/qc). */
export function useDeviationCount() {
  const overrides = useFloorOverrides();
  let n = 0;
  for (const v of Object.values(overrides)) {
    if (v === "warn" || v === "fail" || v === "qc") n++;
  }
  return n;
}