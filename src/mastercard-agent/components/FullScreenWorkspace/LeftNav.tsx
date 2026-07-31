import {
  AlertOctagon,
  ClipboardList,
  History,
  ListChecks,
  MessageSquare,
  Printer,
  Search,
  Settings,
  UploadCloud,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { useMastercardAgentStore } from "../../store";
import { StatusDot } from "../StatusDot";
import { deriveAgentStatus } from "../../lib/status";
import type { WorkspacePage } from "../../types";

const NAV_ITEMS: { page: WorkspacePage; label: string; icon: typeof MessageSquare }[] = [
  { page: "chat", label: "Chat", icon: MessageSquare },
  { page: "search", label: "Mastercard Search", icon: Search },
  { page: "validation", label: "Validation", icon: ListChecks },
  { page: "print-queue", label: "Print Queue", icon: Printer },
  { page: "onfloor-logging", label: "OnFloor Logging", icon: ClipboardList },
  { page: "unlogged-prints", label: "Unlogged Prints", icon: UploadCloud },
  { page: "audit-history", label: "Audit History", icon: History },
  { page: "recovery-queue", label: "Recovery Queue", icon: AlertOctagon },
  { page: "settings", label: "Settings", icon: Settings },
];

export function LeftNav() {
  const activePage = useMastercardAgentStore((s) => s.fullscreenActivePage);
  const setFullscreenPage = useMastercardAgentStore((s) => s.setFullscreenPage);
  const ollamaStatus = useMastercardAgentStore((s) => s.ollamaStatus);
  const indexStatus = useMastercardAgentStore((s) => s.indexStatus);
  const currentOperation = useMastercardAgentStore((s) => s.currentOperation);
  const pendingConfirmation = useMastercardAgentStore((s) => s.pendingConfirmation);

  const status = deriveAgentStatus({ indexStatus, currentOperation, pendingConfirmation });

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col bg-slate-950 text-slate-200">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
          <Wrench className="size-4" />
        </span>
        <span className="text-sm font-semibold text-white">Mastercard Agent</span>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {NAV_ITEMS.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            onClick={() => setFullscreenPage(page)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
              activePage === page ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5 border-t border-slate-800 px-4 py-3 text-[11px] text-slate-400">
        <div className="flex items-center justify-between">
          <span>Agent</span>
          <span className="flex items-center gap-1">
            <StatusDot color={status.color} />
            {status.label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Ollama</span>
          <span className={ollamaStatus.connected ? "text-success" : "text-danger"}>
            {ollamaStatus.connected ? "Connected" : "Offline"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Model</span>
          <span className="truncate text-slate-300">{ollamaStatus.model}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Index</span>
          <span className="text-slate-300">{indexStatus.fileCount.toLocaleString()} files</span>
        </div>
        <div className="flex items-center justify-between pt-1 text-slate-500">
          <span>Mastercard Agent</span>
          <span>v0.1.0-stage1</span>
        </div>
      </div>
    </nav>
  );
}
