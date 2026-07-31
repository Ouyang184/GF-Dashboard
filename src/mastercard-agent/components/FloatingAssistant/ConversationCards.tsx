import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { useMastercardAgentStore } from "../../store";
import { MatchTypeBadge, ValidationBadge } from "../StatusBadge";
import type { ChatCard, DesktopPrintAction, Mastercard, OnFloorLogAction } from "../../types";

function SearchResultsCard({ results }: { results: Mastercard[] }) {
  const selectMastercard = useMastercardAgentStore((s) => s.selectMastercard);
  const [expanded, setExpanded] = useState(false);
  const visibleResults = expanded ? results : results.slice(0, 4);
  return (
    <div className="mt-1.5 space-y-1.5 rounded-lg border border-border bg-card p-2">
      {visibleResults.map((mc) => (
        <button
          key={mc.id}
          onClick={() => selectMastercard(mc)}
          className="flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs hover:border-border hover:bg-muted"
        >
          <span className="min-w-0 truncate">
            <span className="font-semibold">{mc.partNumber}</span>
            <span className="text-muted-foreground"> · mold {mc.moldBaseNumber} · MA{mc.machineNumber}</span>
          </span>
          <MatchTypeBadge matchType={mc.matchType} />
        </button>
      ))}
      {results.length > 4 && (
        <button
          type="button"
          className="w-full px-2 py-1 text-left text-[11px] font-medium text-violet-700 hover:text-violet-900"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show fewer matches" : `Show all ${results.length} matches`}
        </button>
      )}
    </div>
  );
}

function SimpleSearchResultsCard({ results }: { results: Mastercard[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleResults = expanded ? results : results.slice(0, 8);
  return (
    <div className="mt-2 space-y-2">
      {visibleResults.map((mc) => (
        <div key={mc.id} className="border border-slate-200 bg-slate-50 px-3 py-2.5 text-left">
          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-violet-600" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-slate-950">{mc.partNumber}</span>
                <span className="text-xs text-slate-600">Machine {mc.machineNumber}</span>
                <span className="text-xs text-slate-600">Mold {mc.moldBaseNumber}</span>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500" title={mc.filePath}>
                {mc.filePath.split("\\").pop()}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                {mc.sourceFolder.split(" · ")[0]}
              </p>
            </div>
          </div>
        </div>
      ))}
      {results.length > 8 && (
        <button
          type="button"
          className="w-full border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-violet-700 hover:bg-violet-50"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show fewer matches" : `Show all ${results.length} matches`}
        </button>
      )}
    </div>
  );
}

function OnFloorLogConfirmationCard({
  action,
}: {
  action: OnFloorLogAction;
}) {
  const [status, setStatus] = useState<"ready" | "saving" | "done" | "error">("ready");
  const [message, setMessage] = useState("");

  const confirm = async () => {
    if (!window.mastercardDesktop) return;
    setStatus("saving");
    try {
      const result = await window.mastercardDesktop.confirmOnFloorLog(action.id);
      setMessage(result.message);
      setStatus(result.success ? "done" : "error");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Logging failed.");
      setStatus("error");
    }
  };

  return (
    <div className="mt-2 border border-violet-200 bg-violet-50 p-3 text-sm">
      <p className="font-semibold text-slate-950">Log to MasterCard OnFloor?</p>
      <p className="mt-1 text-xs text-slate-600">
        {action.records.length} file{action.records.length === 1 ? "" : "s"} · {action.destination}
      </p>
      {message && (
        <p className={`mt-2 text-xs ${status === "error" ? "text-red-700" : "text-emerald-700"}`}>{message}</p>
      )}
      {status === "ready" && (
        <Button size="sm" className="mt-3 h-8 bg-violet-600 px-3 text-xs hover:bg-violet-700" onClick={() => void confirm()}>
          Confirm logging
        </Button>
      )}
      {status === "saving" && (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-600">
          <Loader2 className="size-3.5 animate-spin" /> Updating Teams workbook…
        </p>
      )}
    </div>
  );
}

function DesktopPrintConfirmationCard({ action }: { action: DesktopPrintAction }) {
  const [status, setStatus] = useState<"ready" | "printing" | "done" | "error">("ready");
  const [message, setMessage] = useState("");
  const record = action.records[0];

  const confirm = async () => {
    if (!window.mastercardDesktop) return;
    setStatus("printing");
    try {
      const result = await window.mastercardDesktop.confirmPrint(action.id);
      setMessage(result.message);
      setStatus(result.success ? "done" : "error");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Printing failed.");
      setStatus("error");
    }
  };

  return (
    <div className="mt-2 border border-cyan-200 bg-cyan-50 p-3 text-sm">
      <p className="font-semibold text-slate-950">Send this Mastercard to print?</p>
      <p className="mt-1 text-xs text-slate-600">
        {record?.partNumber} · Machine {record?.machineNumber} · {action.printer}
      </p>
      {message && (
        <p className={`mt-2 text-xs ${status === "error" ? "text-red-700" : "text-emerald-700"}`}>{message}</p>
      )}
      {status === "ready" && (
        <Button size="sm" className="mt-3 h-8 bg-cyan-700 px-3 text-xs hover:bg-cyan-800" onClick={() => void confirm()}>
          Confirm printing
        </Button>
      )}
      {status === "printing" && (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-600">
          <Loader2 className="size-3.5 animate-spin" /> Sending print command…
        </p>
      )}
    </div>
  );
}

function ValidationResultCard({ result }: { result: ChatCard & { kind: "validation" } }) {
  const r = result.result;
  const icon =
    r.overall === "PASS" ? (
      <CheckCircle2 className="size-4 text-success" />
    ) : r.overall === "WARNING" ? (
      <AlertTriangle className="size-4 text-warning" />
    ) : (
      <XCircle className="size-4 text-danger" />
    );
  return (
    <div className="mt-1.5 space-y-1.5 rounded-lg border border-border bg-card p-2.5 text-xs">
      <div className="flex items-center gap-2">
        {icon}
        <ValidationBadge severity={r.overall} />
        {r.printingBlocked && <span className="text-[11px] font-medium text-danger">Printing blocked</span>}
      </div>
      {r.rules.slice(0, 2).map((rule) => (
        <div key={rule.ruleId} className="border-t border-border pt-1.5 text-muted-foreground">
          <span className="font-mono text-[10px]">{rule.worksheet}!{rule.cell}</span> -- {rule.explanation}
        </div>
      ))}
    </div>
  );
}

function ProgressCard({ card }: { card: ChatCard & { kind: "progress" } }) {
  return (
    <div className="mt-1.5 space-y-1.5 rounded-lg border border-border bg-card p-2.5 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {card.operation.label}
      </div>
      <Progress value={card.progress} className="h-1.5" />
    </div>
  );
}

function PrintStatusCard({ card }: { card: ChatCard & { kind: "print-status" } }) {
  return (
    <div
      className={`mt-1.5 flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
        card.accepted ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger"
      }`}
    >
      {card.accepted ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <XCircle className="mt-0.5 size-3.5 shrink-0" />}
      {card.note}
    </div>
  );
}

function ConfirmationCard({ card }: { card: ChatCard & { kind: "confirmation" } }) {
  const confirmPrint = useMastercardAgentStore((s) => s.confirmPrint);
  const cancelPrint = useMastercardAgentStore((s) => s.cancelPrint);
  const stillPending = useMastercardAgentStore((s) => s.pendingConfirmation?.id === card.confirmation.id);

  return (
    <div className="mt-1.5 space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs">
      <p className="text-warning-foreground">{card.confirmation.message}</p>
      {stillPending ? (
        <div className="flex gap-2">
          <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => void confirmPrint()}>
            Confirm print
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={cancelPrint}>
            Cancel
          </Button>
        </div>
      ) : (
        <p className="text-[11px] italic text-muted-foreground">Resolved.</p>
      )}
    </div>
  );
}

export function ConversationCard({ card }: { card: ChatCard }) {
  switch (card.kind) {
    case "search-results":
      return <SimpleSearchResultsCard results={card.results} />;
    case "log-confirmation":
      return <OnFloorLogConfirmationCard action={card.action} />;
    case "desktop-print-confirmation":
      return <DesktopPrintConfirmationCard action={card.action} />;
    case "validation":
      return <ValidationResultCard result={card} />;
    case "progress":
      return <ProgressCard card={card} />;
    case "confirmation":
      return <ConfirmationCard card={card} />;
    case "print-status":
      return <PrintStatusCard card={card} />;
    case "success":
      return (
        <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-2.5 text-xs text-success">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          {card.message}
        </div>
      );
    case "error":
      return (
        <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">
          <XCircle className="mt-0.5 size-3.5 shrink-0" />
          {card.message}
        </div>
      );
    case "warning":
      return (
        <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {card.message}
        </div>
      );
    default:
      return null;
  }
}
