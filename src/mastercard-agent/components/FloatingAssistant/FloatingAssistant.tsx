import { useEffect } from "react";

import { useMastercardAgentStore } from "../../store";
import { ConversationArea } from "./ConversationArea";
import { FloatingHeader } from "./FloatingHeader";
import { MessageInput } from "./MessageInput";

export function FloatingAssistant({ embedded = false }: { embedded?: boolean }) {
  const markNotificationsRead = useMastercardAgentStore((s) => s.markNotificationsRead);

  useEffect(() => {
    markNotificationsRead();
  }, [markNotificationsRead]);

  return (
    <div className={embedded ? "flex h-full min-h-0 w-full" : "pointer-events-none fixed bottom-4 right-4 z-50"}>
      <div
        className={
          embedded
            ? "flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"
            : "pointer-events-auto flex w-[400px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        }
        style={embedded ? undefined : { height: 620 }}
      >
        <FloatingHeader />
        <ConversationArea />
        <MessageInput />
      </div>
    </div>
  );
}
