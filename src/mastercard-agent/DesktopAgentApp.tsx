import { useEffect } from "react";

import { FloatingAssistant } from "./components/FloatingAssistant/FloatingAssistant";
import { useMastercardAgentStore } from "./store";

export function DesktopAgentApp() {
  const setMode = useMastercardAgentStore((state) => state.setMode);

  useEffect(() => {
    setMode("floating");
  }, [setMode]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-white text-slate-950">
      <FloatingAssistant embedded />
    </main>
  );
}
