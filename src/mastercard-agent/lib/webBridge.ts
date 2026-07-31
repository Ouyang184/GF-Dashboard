/**
 * Browser-side implementation of the same `window.mastercardDesktop`
 * interface the Electron preload script exposes (see ../desktop.d.ts) --
 * backed by fetch calls to the standalone Express server
 * (server/mastercard-agent-server.cjs) instead of Electron IPC. Installed
 * by DesktopAgentApp.tsx only when running outside Electron, so
 * agentReply.ts and everything above it needs zero changes.
 */
import type { Mastercard } from "../types";

const SESSION_STORAGE_KEY = "mastercard-agent-session-id";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  }
  return id;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Request to ${path} failed (${response.status}).`);
  }
  return response.json();
}

async function search(partNumber: string): Promise<Mastercard[]> {
  return requestJson(`/api/mastercards/search?partNumber=${encodeURIComponent(partNumber)}`);
}

async function preparePrint(record: Mastercard) {
  return requestJson<{ printAction: { id: string; printer: string; records: Mastercard[] }; availablePrinters: string[] }>(
    "/api/mastercards/print/prepare",
    { method: "POST", body: JSON.stringify(record) },
  );
}

async function confirmPrint(actionId: string) {
  return requestJson<{ success: boolean; message: string; printed: number; failed: number }>(
    "/api/mastercards/print/confirm",
    { method: "POST", body: JSON.stringify({ actionId }) },
  );
}

async function confirmOnFloorLog(actionId: string) {
  return requestJson<{ success: boolean; message: string; added: number; skipped: number }>(
    "/api/mastercards/log/confirm",
    { method: "POST", body: JSON.stringify({ actionId }) },
  );
}

interface ChatResult {
  content: string;
  matches: Mastercard[];
  model: string;
  logAction?: { id: string; destination: string; records: Mastercard[] };
  printAction?: { id: string; printer: string; records: Mastercard[] };
}

async function chat(message: string, onToken?: (content: string) => void): Promise<ChatResult> {
  const response = await fetch("/api/mastercards/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, sessionId: getSessionId() }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatResult | null = null;
  let errorMessage: string | null = null;

  const consumeLine = (line: string) => {
    if (!line.trim()) return;
    const chunk = JSON.parse(line) as
      | { type: "token"; content: string }
      | { type: "done"; result: ChatResult }
      | { type: "error"; message: string };
    if (chunk.type === "token") onToken?.(chunk.content);
    else if (chunk.type === "done") result = chunk.result;
    else if (chunk.type === "error") errorMessage = chunk.message;
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) consumeLine(line);
    if (done) break;
  }
  consumeLine(buffer);

  if (errorMessage) throw new Error(errorMessage);
  if (!result) throw new Error("Qwen did not return a response.");
  return result;
}

export const webBridge = {
  search,
  preparePrint,
  chat,
  confirmOnFloorLog,
  confirmPrint,
};
