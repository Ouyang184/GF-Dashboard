import { ArrowUp } from "lucide-react";
import { useRef } from "react";
import type { KeyboardEvent } from "react";

import { Textarea } from "@/components/ui/textarea";

import { useMastercardAgentStore } from "../../store";

export function MessageInput() {
  const draftInput = useMastercardAgentStore((state) => state.draftInput);
  const setDraftInput = useMastercardAgentStore((state) => state.setDraftInput);
  const sendMessage = useMastercardAgentStore((state) => state.sendMessage);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!draftInput.trim()) return;
    void sendMessage(draftInput);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      <div className="flex items-end gap-3 border border-slate-300 bg-white px-3 py-2 shadow-sm focus-within:border-violet-500">
        <Textarea
          ref={textareaRef}
          value={draftInput}
          onChange={(event) => setDraftInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a part number…"
          rows={1}
          autoFocus
          className="max-h-28 min-h-10 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-base shadow-none focus-visible:ring-0"
        />
        <button
          type="button"
          className="grid size-10 shrink-0 place-items-center bg-violet-600 text-white transition-colors hover:bg-violet-700 disabled:bg-slate-300"
          onClick={handleSend}
          disabled={!draftInput.trim()}
          aria-label="Search"
        >
          <ArrowUp className="size-5" />
        </button>
      </div>
    </div>
  );
}
