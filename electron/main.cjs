const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");

const core = require("../mastercard-core/core.cjs");

// One Electron window == one user, so a single module-scoped chat session
// (matching the original file's single module-scoped `conversation` array)
// is correct here -- unlike the web server, which must give each browser
// session its own session (see server/mastercard-agent-server.cjs).
const chatSession = core.createChatSession();

ipcMain.handle("mastercards:search", (_event, partNumber) => core.findMastercards(String(partNumber)));

ipcMain.handle("mastercards:preparePrint", (_event, record) => core.preparePrint(record));

ipcMain.handle("agent:chat", async (_event, userText) => core.handleAgentChat(chatSession, userText));

ipcMain.on("agent:chat-stream", async (event, payload) => {
  const requestId = String(payload?.requestId ?? "").replace(/[^A-Za-z0-9-]/g, "");
  if (!requestId) return;
  const channel = `agent:chat-stream:${requestId}`;
  try {
    const result = await core.handleAgentChat(chatSession, payload?.message, (content) => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, { type: "token", content });
    });
    if (!event.sender.isDestroyed()) event.sender.send(channel, { type: "done", result });
  } catch (error) {
    if (!event.sender.isDestroyed()) {
      event.sender.send(channel, {
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
});

ipcMain.handle("agent:confirm-onfloor-log", (_event, actionId) => core.confirmOnFloorLog(actionId));

ipcMain.handle("agent:confirm-print", (_event, actionId) => core.confirmPrint(actionId));

function createWindow() {
  core.startupLog(`Creating window from ${__dirname}`);
  const window = new BrowserWindow({
    title: "Mastercard Agent",
    width: 480,
    height: 460,
    minWidth: 420,
    minHeight: 360,
    center: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("did-fail-load", (_event, code, description, url) => {
    core.startupLog(`Renderer failed to load: ${code} ${description} ${url}`);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    core.startupLog(`Renderer process exited: ${JSON.stringify(details)}`);
  });

  void window
    .loadFile(path.join(__dirname, "..", "dist", "index.html"), {
      query: { desktopAgent: "1" },
    })
    .then(() => core.startupLog("Window loaded successfully"))
    .catch((error) => core.startupLog("Window load failed", error));
}

app.whenReady().then(() => {
  core.startupLog(`Application ready; Electron ${process.versions.electron}; Windows ${process.getSystemVersion()}`);
  createWindow();
  core
    .warmOllama()
    .then(() => core.startupLog(`Warmed ${core.OLLAMA_MODEL}`))
    .catch((error) => core.startupLog(`Could not warm ${core.OLLAMA_MODEL}`, error));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
