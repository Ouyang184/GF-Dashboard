import { ArrowLeft, Box, Gauge, Shield, Truck, BadgeCheck, X } from "lucide-react";

import { useDashboardRemote, type ControlPillar } from "@/hooks/use-dashboard-control";

const CONTROLS: { key: ControlPillar; label: string; icon: typeof Shield }[] = [
  { key: "S", label: "Safety", icon: Shield },
  { key: "Q", label: "Quality", icon: BadgeCheck },
  { key: "D", label: "Process Deviation", icon: Truck },
  { key: "I", label: "Product Deviation", icon: Box },
  { key: "P", label: "Productivity", icon: Gauge },
];

export function DashboardControl({ onViewDashboard }: { onViewDashboard?: () => void }) {
  const { send, isSending, error } = useDashboardRemote();
  return (
    <main className="min-h-screen bg-background p-4 text-foreground">
      <div className="mx-auto max-w-md">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">+GF+ AMG</div>
            <h1 className="text-2xl font-bold">Dashboard Control</h1>
          </div>
          {onViewDashboard ? (
            <button type="button" onClick={onViewDashboard} className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-xs font-semibold" aria-label="View full dashboard"><ArrowLeft className="size-4" />Dashboard</button>
          ) : (
            <a href="/" className="grid size-10 place-items-center rounded-sm border border-border bg-card" aria-label="Back to dashboard"><ArrowLeft className="size-5" /></a>
          )}
        </div>
        <p className="mb-4 text-sm text-muted-foreground">Choose a pillar to open on the wall dashboard.</p>
        <div className="grid gap-3">
          {CONTROLS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" disabled={isSending} onClick={() => void send({ command: "OpenPillar", target: key })} className="flex min-h-16 items-center gap-3 rounded-sm border border-primary/30 bg-card px-4 text-left shadow-[var(--shadow-card)] disabled:opacity-50">
              <span className="grid size-10 place-items-center rounded-sm bg-primary text-primary-foreground"><Icon className="size-5" /></span>
              <span className="font-semibold">Open {label}</span>
            </button>
          ))}
          <button type="button" disabled={isSending} onClick={() => void send({ command: "CloseAll" })} className="mt-2 flex min-h-14 items-center justify-center gap-2 rounded-sm border border-danger/40 bg-danger/10 font-semibold text-danger disabled:opacity-50"><X className="size-5" />Close expanded pillar</button>
        </div>
        <p className="mt-4 min-h-5 text-center text-xs text-muted-foreground">{isSending ? "Sending command…" : error instanceof Error ? error.message : "Commands normally appear within 1–3 seconds."}</p>
      </div>
    </main>
  );
}
