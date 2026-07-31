import { ChevronUp, Loader2, Wrench } from "lucide-react";

import { useMastercardAgentStore } from "../store";
import { deriveAgentStatus } from "../lib/status";
import { StatusDot } from "./StatusDot";

export function MiniTab() {
  const setMode = useMastercardAgentStore((s) => s.setMode);
  const markNotificationsRead = useMastercardAgentStore((s) => s.markNotificationsRead);
  const indexStatus = useMastercardAgentStore((s) => s.indexStatus);
  const currentOperation = useMastercardAgentStore((s) => s.currentOperation);
  const pendingConfirmation = useMastercardAgentStore((s) => s.pendingConfirmation);
  const unreadCount = useMastercardAgentStore((s) => s.unreadCount);

  const status = deriveAgentStatus({ indexStatus, currentOperation, pendingConfirmation });
  const isWorking = currentOperation?.status === "running";

  return (
    <div className="pointer-events-none fixed bottom-14 right-4 z-50">
      <button
        type="button"
        onClick={() => setMode("floating")}
        onDoubleClick={() => setMode("fullscreen")}
        title="Mastercard Agent -- click to open, double-click for full workspace"
        className="pointer-events-auto flex h-[52px] w-[170px] items-center gap-2 rounded-full border border-border bg-card px-3 text-card-foreground shadow-[var(--shadow-card)] transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-lg"
      >
        <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Wrench className="size-4" />
          {unreadCount > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                markNotificationsRead();
              }}
              className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-bold text-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
          <span className="text-xs font-semibold">MC Agent</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {isWorking ? <Loader2 className="size-2.5 animate-spin" /> : <StatusDot color={status.color} />}
            <span className="truncate">{isWorking ? "Working..." : status.label}</span>
          </span>
        </span>

        <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}
