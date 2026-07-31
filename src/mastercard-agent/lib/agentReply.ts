/**
 * A small, fully deterministic keyword-matching interpreter standing in for
 * Ollama in the browser preview -- NOT a real LLM call (per spec: no cloud
 * AI, and a local Ollama endpoint isn't reachable from a browser preview
 * anyway). It only picks which mocked backendBridge call to make and a
 * short label for the activity feed; it never writes a scripted sentence.
 * Every fact still comes from backendBridge's mocked Python-shaped
 * responses -- mirroring the real architecture's rule that the model
 * selects tools, Python decides facts.
 */
import { backendBridge } from "./backendBridge";
import type { ChatCard } from "../types";

export interface AgentReplyResult {
  label: string;
  content?: string;
  cards?: ChatCard[];
}

function extractPartNumber(text: string): string | null {
  const match = text.match(/\b(?=[A-Za-z0-9-]*\d)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\b/);
  return match ? match[0] : null;
}

function extractField(text: string, label: RegExp): string | null {
  const match = text.match(label);
  return match ? match[1] : null;
}

export async function generateAgentReply(
  userText: string,
  onToken?: (content: string) => void,
): Promise<AgentReplyResult> {
  const text = userText.trim();
  const lower = text.toLowerCase();

  if (window.mastercardDesktop?.chat) {
    try {
      const reply = await window.mastercardDesktop.chat(text, onToken);
      return {
        label: "QWEN",
        content: reply.content,
        cards: [
          ...(reply.matches.length > 0 ? ([{ kind: "search-results", results: reply.matches }] as ChatCard[]) : []),
          ...(reply.logAction ? ([{ kind: "log-confirmation", action: reply.logAction }] as ChatCard[]) : []),
          ...(reply.printAction
            ? ([{ kind: "desktop-print-confirmation", action: reply.printAction }] as ChatCard[])
            : []),
        ],
      };
    } catch (error) {
      return {
        label: "QWEN OFFLINE",
        cards: [
          {
            kind: "error",
            message: error instanceof Error ? error.message : "The local Qwen model is unavailable.",
          },
        ],
      };
    }
  }

  const partNumber =
    extractField(text, /part(?:\s+number)?\s+([A-Za-z0-9\-]+)/i) ??
    extractPartNumber(text);
  const mold = extractField(text, /mold\s+([A-Za-z0-9]+)/i);
  const machine = extractField(text, /machine\s+([A-Za-z0-9]+)/i);

  if (lower.includes("validate")) {
    return { label: "VALIDATE", cards: [{ kind: "warning", message: "No file selected. Search first, then select a result." }] };
  }

  if (lower.includes("print")) {
    return { label: "PRINT", cards: [{ kind: "warning", message: "No file selected. Search first, then select a result." }] };
  }

  if (lower.includes("log")) {
    return { label: "LOG", cards: [{ kind: "warning", message: "Logging requires a successful print command first -- never a failed or cancelled one." }] };
  }

  if (lower.includes("unlogged") || lower.includes("not logged")) {
    return { label: "UNLOGGED PRINTS", cards: [{ kind: "success", message: "See OnFloor Logging → Unlogged tab for the full list." }] };
  }

  if (lower.includes("comparable")) {
    const { matches, matchType } = await backendBridge.searchMastercards({
      partNumber: partNumber ?? undefined,
      moldBaseNumber: mold ?? undefined,
      machineNumber: machine ?? undefined,
      includeComparable: true,
    });
    if (matches.length === 0) {
      return { label: "COMPARABLE SEARCH", cards: [{ kind: "warning", message: "No comparable Mastercard on a sister machine." }] };
    }
    return { label: `COMPARABLE SEARCH · ${matchType}`, cards: [{ kind: "search-results", results: matches }] };
  }

  if (partNumber) {
    const { matches, matchType } = await backendBridge.searchMastercards({
      partNumber,
      moldBaseNumber: mold ?? undefined,
      machineNumber: machine ?? undefined,
    });

    if (matches.length === 0) {
      return {
        label: `SEARCH · ${partNumber}`,
        cards: [{ kind: "warning", message: "No match in the index." }],
      };
    }

    return {
      label: `SEARCH · ${partNumber} · ${matchType}`,
      cards: [{ kind: "search-results", results: matches }],
    };
  }

  return {
    label: "NO MATCH",
    cards: [{ kind: "warning", message: 'Try a part number, or "comparable" / "validate" / "print" / "log".' }],
  };
}
