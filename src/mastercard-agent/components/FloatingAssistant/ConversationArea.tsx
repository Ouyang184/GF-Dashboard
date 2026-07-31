import { useEffect, useRef } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  ListChecks,
  Printer,
  Search,
  XCircle,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { useMastercardAgentStore } from "../../store";
import { ConversationCard } from "./ConversationCards";
import type { ChatCard, ChatMessage } from "../../types";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function eventIcon(cards: ChatCard[] | undefined) {
  const kind = cards?.[0]?.kind;
  switch (kind) {
    case "search-results":
      return Search;
    case "validation":
      return ListChecks;
    case "progress":
      return Loader2;
    case "confirmation":
      return AlertOctagon;
    case "print-status":
      return Printer;
    case "success":
      return CheckCircle2;
    case "error":
      return XCircle;
    case "warning":
      return AlertTriangle;
    default:
      return CheckCircle2;
  }
}

interface ConversationAreaProps {
  className?: string;
}

const EMPTY_HINT = "Search the Mastercard library by part number.";

export function ConversationArea({ className }: ConversationAreaProps) {
  const conversation = useMastercardAgentStore((s) => s.conversation);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation.length]);

  return (
    <ScrollArea className={cn("flex-1", className)}>
      <div className="flex flex-col divide-y divide-border/60 px-1 py-1">
        {conversation.length === 0 && (
          <p className="px-2.5 py-4 text-xs text-muted-foreground">{EMPTY_HINT}</p>
        )}
        {conversation.map((message) => (
          <FeedRow key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function FeedRow({ message }: { message: ChatMessage }) {
  if (message.role === "query") {
    return (
      <div className="flex items-center gap-2 px-2.5 py-2 text-sm">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-foreground">{message.content}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{formatTime(message.timestamp)}</span>
      </div>
    );
  }

  const Icon = eventIcon(message.cards);
  const isSpinning = message.cards?.[0]?.kind === "progress";

  return (
    <div className="px-2.5 py-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-3.5 shrink-0 text-muted-foreground", isSpinning && "animate-spin")} />
        <span className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {message.content}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{formatTime(message.timestamp)}</span>
      </div>
      {message.cards?.map((card, i) => (
        <div key={i} className="pl-[22px]">
          <ConversationCard card={card} />
        </div>
      ))}
    </div>
  );
}
