import { FolderOpen, ListChecks, Printer, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { desktopBridge } from "../../lib/desktopBridge";
import { useMastercardAgentStore } from "../../store";
import { MatchTypeBadge, ValidationBadge } from "../StatusBadge";

export function SelectedMastercardCard() {
  const selected = useMastercardAgentStore((s) => s.selectedMastercard);
  const selectMastercard = useMastercardAgentStore((s) => s.selectMastercard);
  const runValidate = useMastercardAgentStore((s) => s.runValidate);
  const preparePrint = useMastercardAgentStore((s) => s.preparePrint);
  const setMode = useMastercardAgentStore((s) => s.setMode);
  const setFullscreenPage = useMastercardAgentStore((s) => s.setFullscreenPage);
  const validationResults = useMastercardAgentStore((s) => s.validationResults);

  if (!selected) return null;
  const validation = validationResults[selected.id];

  return (
    <div className="mx-3 mb-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-sm">{selected.partNumber}</p>
          <p className="text-muted-foreground">
            Mold {selected.moldBaseNumber} · Machine {selected.machineNumber} · {selected.fileType.toUpperCase()}
          </p>
        </div>
        <button onClick={() => selectMastercard(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <MatchTypeBadge matchType={selected.matchType} />
        <ValidationBadge severity={validation?.overall ?? selected.validationStatus} />
      </div>
      <p className="mb-2 truncate text-[11px] text-muted-foreground" title={selected.sourceFolder}>
        {selected.sourceFolder}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => void desktopBridge.openLocalFile(selected.filePath)}>
          <FolderOpen className="size-3.5" /> Open
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => void runValidate(selected)}>
          <ListChecks className="size-3.5" /> Validate
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px]"
          disabled={validation?.printingBlocked}
          onClick={() => void preparePrint(selected)}
        >
          <Printer className="size-3.5" /> Prepare Print
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px]"
          onClick={() => {
            setFullscreenPage("search");
            setMode("fullscreen");
          }}
        >
          View Details
        </Button>
      </div>
    </div>
  );
}
