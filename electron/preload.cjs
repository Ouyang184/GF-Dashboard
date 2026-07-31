const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mastercardDesktop", {
  search: (partNumber) => ipcRenderer.invoke("mastercards:search", partNumber),
  preparePrint: (record) => ipcRenderer.invoke("mastercards:preparePrint", record),
  chat: (message, onToken) =>
    new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const channel = `agent:chat-stream:${requestId}`;
      const listener = (_event, payload) => {
        if (payload?.type === "token") {
          if (typeof onToken === "function") onToken(payload.content);
          return;
        }
        ipcRenderer.removeListener(channel, listener);
        if (payload?.type === "done") resolve(payload.result);
        else reject(new Error(payload?.message ?? "Qwen did not return a response."));
      };
      ipcRenderer.on(channel, listener);
      ipcRenderer.send("agent:chat-stream", { requestId, message });
    }),
  confirmOnFloorLog: (actionId) => ipcRenderer.invoke("agent:confirm-onfloor-log", actionId),
  confirmPrint: (actionId) => ipcRenderer.invoke("agent:confirm-print", actionId),
});
