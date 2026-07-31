import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

import "./styles.css";

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Dashboard render failed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <StartupError error={this.state.error} />;
  }
}

function StartupError({ error }: { error: Error }) {
  return (
    <main style={{ padding: 32, fontFamily: "Segoe UI, sans-serif", color: "#991b1b" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Dashboard could not start</h1>
      <pre style={{ whiteSpace: "pre-wrap", color: "#1f2937" }}>{error.stack ?? error.message}</pre>
    </main>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found");
}
const appRoot = root;
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Persist query results to localStorage so cards with large/slow SharePoint
// queries (e.g. a full fiscal year of Mastercards) render instantly from
// last-known data on load instead of showing blank while refetching.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "amg-dashboard-query-cache",
});

window.addEventListener("error", (event) => console.error("Uncaught browser error", event.error));
window.addEventListener("unhandledrejection", (event) => console.error("Unhandled promise rejection", event.reason));

async function start() {
  try {
    const desktopAgent = new URLSearchParams(window.location.search).get("desktopAgent") === "1";
    const PageComponent = desktopAgent
      ? (await import("./mastercard-agent/DesktopAgentApp")).DesktopAgentApp
      : (await import("./routes/index")).Index;

    createRoot(appRoot).render(
      <StrictMode>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: 24 * 60 * 60_000 }}
        >
          <AppErrorBoundary>
            <PageComponent />
          </AppErrorBoundary>
        </PersistQueryClientProvider>
      </StrictMode>,
    );
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    console.error("Dashboard startup failed", error);
    createRoot(appRoot).render(<StartupError error={error} />);
  }
}

void start();
