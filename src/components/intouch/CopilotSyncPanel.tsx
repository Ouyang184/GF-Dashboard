import { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { COPILOT_PROMPT } from "@/lib/intouch-layout";
import { useIntouchSnapshot } from "@/hooks/use-intouch-snapshot";

type Props = ReturnType<typeof useIntouchSnapshot>;

export function CopilotSyncPanel({ snapshot, busy, error, ingestJson, reset, minutesSinceSync }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  const stale = minutesSinceSync !== null && minutesSinceSync >= 5;
  const matched = snapshot ? Object.keys(snapshot.results).length : 0;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(COPILOT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  const apply = () => {
    if (ingestJson(draft)) {
      setDraft("");
      setOpen(false);
    }
  };

  const agoLabel =
    minutesSinceSync === null
      ? null
      : minutesSinceSync < 1
        ? "just now"
        : `${minutesSinceSync} min ago`;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Floor Layout</h3>
          {snapshot ? (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] rounded-full border px-2 py-0.5 ${
                stale
                  ? "border-warning/60 text-warning"
                  : "border-border/60 text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${stale ? "bg-warning animate-pulse" : "bg-success"}`}
              />
              InTouch · Copilot · synced {agoLabel} · {matched} tiles
              {stale && " · refresh due"}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              No InTouch sync yet — use Copilot to read the board.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs rounded-md border border-border/60 bg-secondary/60 hover:bg-secondary px-3 py-1.5 transition"
          >
            {snapshot ? "Re-sync from Copilot" : "Sync from Copilot"}
          </button>
          {snapshot && (
            <button
              type="button"
              onClick={reset}
              className="text-xs rounded-md border border-border/60 bg-transparent hover:bg-secondary/40 px-3 py-1.5 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-3">
          <ol className="text-xs text-muted-foreground list-decimal pl-5 space-y-1">
            <li>Screenshot the InTouch board (Win+Shift+S).</li>
            <li>Open Copilot Chat (Edge sidebar or Teams) and paste the screenshot.</li>
            <li>Paste the prompt below, send, then paste Copilot's JSON reply here.</li>
          </ol>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Copilot prompt</span>
              <button
                type="button"
                onClick={copyPrompt}
                className="inline-flex items-center gap-1 text-[11px] rounded-md border border-border/60 bg-card hover:bg-secondary px-2 py-1"
              >
                {copied ? <Check className="size-3" /> : <ClipboardCopy className="size-3" />}
                {copied ? "Copied" : "Copy prompt"}
              </button>
            </div>
            <pre className="text-[10.5px] leading-snug bg-background/60 border border-border/60 rounded-md p-2 max-h-32 overflow-auto font-mono">
              {COPILOT_PROMPT}
            </pre>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Paste Copilot JSON</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              placeholder='{ "sampledAt": "...", "results": [ { "id": "11EM00", "status": "ok" } ] }'
              className="mt-1 w-full h-36 rounded-md bg-background/60 border border-border/60 p-2 text-[11px] font-mono outline-none focus:ring-1 focus:ring-accent/60"
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setDraft(""); }}
              className="text-xs rounded-md border border-border/60 px-3 py-1.5 hover:bg-secondary/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={busy || !draft.trim()}
              className="text-xs rounded-md bg-accent text-accent-foreground px-3 py-1.5 disabled:opacity-50 hover:opacity-90"
            >
              {busy ? "Parsing…" : "Apply"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}