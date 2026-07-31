import { create } from "zustand";

import { backendBridge } from "./lib/backendBridge";
import { desktopBridge } from "./lib/desktopBridge";
import { generateAgentReply } from "./lib/agentReply";
import { mockIndexStatus, mockOllamaStatus } from "./mockData";
import type {
  ChatMessage,
  DisplayMode,
  IndexStatus,
  Mastercard,
  OllamaStatus,
  Operation,
  PendingConfirmation,
  PrintQueueItem,
  ValidationResult,
  WindowState,
  WorkspacePage,
} from "./types";

let messageCounter = 0;
function nextId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-${Date.now()}-${messageCounter}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface MastercardAgentState {
  mode: DisplayMode;
  conversation: ChatMessage[];
  draftInput: string;
  selectedMastercard: Mastercard | null;
  searchResults: Mastercard[];
  validationResults: Record<string, ValidationResult>;
  pendingConfirmation: PendingConfirmation | null;
  activePrintQueueItem: PrintQueueItem | null;
  currentOperation: Operation | null;
  operationProgress: number;
  indexStatus: IndexStatus;
  ollamaStatus: OllamaStatus;
  unreadCount: number;
  previousWindowState: WindowState | null;
  fullscreenActivePage: WorkspacePage;
  theme: "light" | "dark";
  alwaysOnTop: boolean;

  setMode: (mode: DisplayMode) => void;
  setDraftInput: (value: string) => void;
  sendMessage: (text: string) => Promise<void>;
  selectMastercard: (mastercard: Mastercard | null) => void;
  runSearch: (filters: Parameters<typeof backendBridge.searchMastercards>[0]) => Promise<void>;
  runValidate: (mastercard: Mastercard) => Promise<void>;
  preparePrint: (mastercard: Mastercard) => Promise<void>;
  confirmPrint: () => Promise<void>;
  cancelPrint: () => void;
  quickPrint: (mastercard: Mastercard) => Promise<void>;
  logPrint: () => Promise<void>;
  refreshIndex: () => Promise<void>;
  markNotificationsRead: () => void;
  setFullscreenPage: (page: WorkspacePage) => void;
  setPreviousWindowState: (state: WindowState) => void;
  toggleTheme: () => void;
  toggleAlwaysOnTop: () => void;
}

function pushMessage(conversation: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return [...conversation, message];
}

export const useMastercardAgentStore = create<MastercardAgentState>((set, get) => ({
  mode: "mini",
  conversation: [],
  draftInput: "",
  selectedMastercard: null,
  searchResults: [],
  validationResults: {},
  pendingConfirmation: null,
  activePrintQueueItem: null,
  currentOperation: null,
  operationProgress: 0,
  indexStatus: mockIndexStatus,
  ollamaStatus: mockOllamaStatus,
  unreadCount: 0,
  previousWindowState: null,
  fullscreenActivePage: "chat",
  theme: "light",
  alwaysOnTop: false,

  setMode: (mode) => {
    void desktopBridge.setWindowMode(mode);
    set({ mode });
  },

  setDraftInput: (value) => set({ draftInput: value }),

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const queryMessage: ChatMessage = {
      id: nextId("msg"),
      role: "query",
      content: trimmed,
      timestamp: nowIso(),
    };
    const replyMessageId = nextId("msg");
    const replyMessage: ChatMessage = {
      id: replyMessageId,
      role: "event",
      content: "Qwen is thinking...",
      timestamp: nowIso(),
    };
    set((state) => ({
      conversation: [...state.conversation, queryMessage, replyMessage],
      draftInput: "",
      currentOperation: { id: nextId("op"), type: "search", label: "Working...", status: "running" },
      operationProgress: 30,
    }));

    const reply = await generateAgentReply(trimmed, (content) => {
      set((state) => ({
        conversation: state.conversation.map((message) =>
          message.id === replyMessageId ? { ...message, content } : message,
        ),
      }));
    });

    set((state) => {
      const isCollapsed = state.mode !== "floating" && state.mode !== "fullscreen";
      return {
        conversation: state.conversation.map((message) =>
          message.id === replyMessageId
            ? { ...message, content: reply.content ?? reply.label, cards: reply.cards }
            : message,
        ),
        currentOperation: null,
        operationProgress: 0,
        unreadCount: isCollapsed ? state.unreadCount + 1 : state.unreadCount,
        searchResults:
          reply.cards?.find((c) => c.kind === "search-results")?.kind === "search-results"
            ? (reply.cards.find((c) => c.kind === "search-results") as { kind: "search-results"; results: Mastercard[] }).results
            : state.searchResults,
      };
    });
  },

  selectMastercard: (mastercard) => set({ selectedMastercard: mastercard }),

  runSearch: async (filters) => {
    set({
      currentOperation: { id: nextId("op"), type: "search", label: "Searching index...", status: "running" },
      operationProgress: 40,
    });
    const { matches } = await backendBridge.searchMastercards(filters);
    set({ searchResults: matches, currentOperation: null, operationProgress: 0 });
  },

  runValidate: async (mastercard) => {
    set({
      currentOperation: { id: nextId("op"), type: "validate", label: `Validating ${mastercard.partNumber}...`, status: "running" },
      operationProgress: 50,
    });
    const result = await backendBridge.validateMastercard(mastercard.filePath);
    set((state) => ({
      validationResults: { ...state.validationResults, [mastercard.id]: result },
      currentOperation: null,
      operationProgress: 0,
      unreadCount: state.mode === "mini" ? state.unreadCount + 1 : state.unreadCount,
      conversation: pushMessage(state.conversation, {
        id: nextId("msg"),
        role: "event",
        content: `VALIDATE · ${mastercard.partNumber}`,
        timestamp: nowIso(),
        cards: [{ kind: "validation", result }],
      }),
    }));
  },

  preparePrint: async (mastercard) => {
    set({
      currentOperation: { id: nextId("op"), type: "print", label: "Preparing print...", status: "running" },
      operationProgress: 40,
    });
    const item = await backendBridge.preparePrint(mastercard.filePath);
    const confirmation: PendingConfirmation | null =
      item.status === "Blocked"
        ? null
        : {
            id: nextId("confirm"),
            kind: "print",
            printQueueItemId: item.id,
            message: `Print ${item.mastercard.partNumber} (${item.sheets} sheet${item.sheets === 1 ? "" : "s"}, ${item.copies} copy) to ${item.printer}? Dry-run mode is ${item.dryRun ? "ON" : "OFF"}.`,
          };
    set((state) => ({
      activePrintQueueItem: item,
      pendingConfirmation: confirmation,
      currentOperation: null,
      operationProgress: 0,
      conversation: pushMessage(state.conversation, {
        id: nextId("msg"),
        role: "event",
        content: `PRINT · ${item.mastercard.partNumber}${item.status === "Blocked" ? " · Blocked" : " · Confirm"}`,
        timestamp: nowIso(),
        cards: [
          item.status === "Blocked"
            ? { kind: "error", message: "Validation failed. Fix the source workbook before retrying." }
            : { kind: "confirmation", confirmation: confirmation! },
        ],
      }),
    }));
  },

  confirmPrint: async () => {
    const item = get().activePrintQueueItem;
    if (!item) return;
    set({
      pendingConfirmation: null,
      currentOperation: { id: nextId("op"), type: "print", label: "Sending print command...", status: "running" },
      operationProgress: 60,
    });
    const updated = await backendBridge.confirmPrint(item);
    set((state) => ({
      activePrintQueueItem: updated,
      currentOperation: null,
      operationProgress: 0,
      conversation: pushMessage(state.conversation, {
        id: nextId("msg"),
        role: "event",
        content: `PRINT · ${updated.mastercard.partNumber}`,
        timestamp: nowIso(),
        cards: [
          {
            kind: "print-status",
            accepted: updated.status === "Print Command Accepted",
            note:
              updated.status === "Print Command Accepted"
                ? "Command accepted — not confirmed printed."
                : "Print command failed.",
          },
        ],
      }),
    }));
  },

  cancelPrint: () => set({ pendingConfirmation: null, activePrintQueueItem: null }),

  // A one-click shortcut from a result card's Print button, so the user
  // never has to type "print this" -- reuses the exact same confirmation
  // flow (desktop-print-confirmation card, explicit confirm required) the
  // chat-driven print path already uses. Only wired for the real Electron
  // app; no-ops in the browser-preview mock.
  quickPrint: async (mastercard) => {
    if (!window.mastercardDesktop?.preparePrint) return;
    set((state) => ({
      conversation: pushMessage(state.conversation, {
        id: nextId("msg"),
        role: "event",
        content: `PRINT · ${mastercard.partNumber}`,
        timestamp: nowIso(),
      }),
    }));
    try {
      const result = await window.mastercardDesktop.preparePrint(mastercard);
      set((state) => ({
        conversation: pushMessage(state.conversation, {
          id: nextId("msg"),
          role: "event",
          content: `PRINT · ${mastercard.partNumber} · Confirm`,
          timestamp: nowIso(),
          cards: [{ kind: "desktop-print-confirmation", action: result.printAction }],
        }),
      }));
    } catch (error) {
      set((state) => ({
        conversation: pushMessage(state.conversation, {
          id: nextId("msg"),
          role: "event",
          content: `PRINT · ${mastercard.partNumber} · Failed`,
          timestamp: nowIso(),
          cards: [{ kind: "error", message: error instanceof Error ? error.message : "Could not prepare print." }],
        }),
      }));
    }
  },

  logPrint: async () => {
    const item = get().activePrintQueueItem;
    if (!item) return;
    set({
      currentOperation: { id: nextId("op"), type: "log", label: "Logging to OnFloor...", status: "running" },
      operationProgress: 70,
    });
    const result = await backendBridge.logPrintedMastercard(item);
    set((state) => ({
      currentOperation: null,
      operationProgress: 0,
      conversation: pushMessage(state.conversation, {
        id: nextId("msg"),
        role: "event",
        content: `LOG · ${item.mastercard.partNumber}${result.success ? "" : " · Failed"}`,
        timestamp: nowIso(),
        cards: [result.success ? { kind: "success", message: result.message } : { kind: "error", message: result.message }],
      }),
    }));
  },

  refreshIndex: async () => {
    set({
      currentOperation: { id: nextId("op"), type: "refresh-index", label: "Refreshing index...", status: "running" },
      operationProgress: 20,
    });
    const status = await backendBridge.refreshIndex();
    set({ indexStatus: status, currentOperation: null, operationProgress: 0 });
  },

  markNotificationsRead: () => set({ unreadCount: 0 }),

  setFullscreenPage: (page) => set({ fullscreenActivePage: page }),

  setPreviousWindowState: (state) => set({ previousWindowState: state }),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "light" ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      return { theme: next };
    }),

  toggleAlwaysOnTop: () =>
    set((state) => {
      const next = !state.alwaysOnTop;
      void desktopBridge.setAlwaysOnTop(next);
      return { alwaysOnTop: next };
    }),
}));
