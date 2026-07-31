const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const core = require("../mastercard-core/core.cjs");

const PORT = Number(process.env.MASTERCARD_SERVER_PORT || 4100);
const DIST_DIR = path.join(__dirname, "..", "dist");

// One conversation history per browser tab, keyed by a client-generated id
// (see src/mastercard-agent/lib/webBridge.ts) -- this process serves many
// concurrent users, unlike the Electron app's single module-scoped session,
// so mixing histories here would leak one user's question/context into
// another user's answer. Idle sessions are pruned so this can't grow
// unbounded over a long-running server process.
const chatSessions = new Map();
const SESSION_IDLE_TTL_MS = 60 * 60 * 1000;

function getSession(sessionId) {
  const id = String(sessionId || "").trim();
  if (!id) throw new Error("Missing session id.");
  const existing = chatSessions.get(id);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.session;
  }
  const session = core.createChatSession();
  chatSessions.set(id, { session, lastUsed: Date.now() });
  return session;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of chatSessions) {
    if (now - entry.lastUsed > SESSION_IDLE_TTL_MS) chatSessions.delete(id);
  }
}, 10 * 60 * 1000).unref();

const app = express();
app.use(express.json({ limit: "5mb" }));

function asyncRoute(handler) {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

app.get(
  "/api/mastercards/search",
  asyncRoute(async (req, res) => {
    const partNumber = String(req.query.partNumber ?? "");
    res.json(await core.findMastercards(partNumber));
  }),
);

app.get(
  "/api/mastercards/printers",
  asyncRoute(async (_req, res) => {
    res.json(await core.getAvailablePrinters());
  }),
);

app.post(
  "/api/mastercards/print/prepare",
  asyncRoute(async (req, res) => {
    res.json(await core.preparePrint(req.body));
  }),
);

app.post(
  "/api/mastercards/print/confirm",
  asyncRoute(async (req, res) => {
    res.json(await core.confirmPrint(req.body?.actionId));
  }),
);

app.post(
  "/api/mastercards/log/confirm",
  asyncRoute(async (req, res) => {
    res.json(await core.confirmOnFloorLog(req.body?.actionId));
  }),
);

// Streams newline-delimited JSON chunks -- {"type":"token","content":"..."}
// while the model is generating, then a final {"type":"done","result":{...}}
// or {"type":"error","message":"..."}. Mirrors the shape of the Electron
// IPC streaming channel (agent:chat-stream) closely enough that the web
// bridge and desktop bridge present the same interface to the React UI.
app.post("/api/mastercards/chat", async (req, res) => {
  res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
  const write = (payload) => res.write(`${JSON.stringify(payload)}\n`);
  try {
    const session = getSession(req.body?.sessionId);
    const result = await core.handleAgentChat(session, req.body?.message, (content) => {
      write({ type: "token", content });
    });
    write({ type: "done", result });
  } catch (error) {
    write({ type: "error", message: error instanceof Error ? error.message : String(error) });
  } finally {
    res.end();
  }
});

app.use((error, _req, res, _next) => {
  core.startupLog("Request failed", error);
  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
});

// Serves the built frontend so the whole app is one process on one port --
// sharing it is just http://<host>:<port>/?desktopAgent=1, no separate
// frontend deploy or CORS setup needed.
app.use(express.static(DIST_DIR));

app.listen(PORT, () => {
  core.startupLog(`Mastercard Agent server listening on port ${PORT}`);
  console.log(`Mastercard Agent server listening on http://localhost:${PORT}/?desktopAgent=1`);
  core
    .warmOllama()
    .then(() => core.startupLog(`Warmed ${core.OLLAMA_MODEL}`))
    .catch((error) => core.startupLog(`Could not warm ${core.OLLAMA_MODEL}`, error));
});
