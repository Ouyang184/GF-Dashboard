import { useEffect } from "react";

import { FloatingAssistant } from "./components/FloatingAssistant/FloatingAssistant";
import { useMastercardAgentStore } from "./store";
import { webBridge } from "./lib/webBridge";

// Electron's preload script sets window.mastercardDesktop before this module
// ever loads. Running in a plain browser, it won't exist yet -- install the
// HTTP-backed implementation so agentReply.ts (which only checks
// `window.mastercardDesktop?.chat`) gets a real backend either way.
if (!window.mastercardDesktop) {
  window.mastercardDesktop = webBridge;
}

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
