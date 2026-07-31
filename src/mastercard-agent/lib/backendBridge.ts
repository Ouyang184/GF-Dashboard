/**
 * Typed bridge to the future local Python Mastercard service (Stage 1-5 of
 * the companion desktop app). Every method here is a mock -- realistic
 * shapes and simulated latency, no real filesystem/Excel/printer access --
 * so every screen and transition in this UI can be exercised today. A real
 * implementation swaps the bodies for fetch()/IPC calls to the Python
 * service; the exported function signatures are the contract components and
 * the Zustand store are written against, so that swap never touches a
 * component.
 */
import {
  mockAuditHistory,
  mockIndexStatus,
  mockMastercards,
  mockOllamaStatus,
  mockOnFloorRecords,
  mockRecoveryRecords,
  mockValidationResults,
} from "../mockData";
import type {
  AuditEntry,
  IndexStatus,
  Mastercard,
  MatchType,
  OllamaStatus,
  OnFloorRecord,
  PrintQueueItem,
  RecoveryRecord,
  SearchFilters,
  ValidationResult,
} from "../types";

function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function normalize(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export interface SearchRequest extends Partial<SearchFilters> {
  freeText?: string;
}

export interface SearchResponse {
  matches: Mastercard[];
  matchType: MatchType;
}

function classifyMatches(matches: Mastercard[]): MatchType {
  if (matches.length === 0) return "Missing";
  if (matches.length > 1) return "Multiple";
  return matches[0].matchType;
}

export const backendBridge = {
  async searchMastercards(request: SearchRequest): Promise<SearchResponse> {
    if (window.mastercardDesktop && request.partNumber) {
      const matches = await window.mastercardDesktop.search(request.partNumber);
      return { matches, matchType: classifyMatches(matches) };
    }

    const part = request.partNumber ? normalize(request.partNumber) : "";
    const mold = request.moldBaseNumber ? normalize(request.moldBaseNumber) : "";
    const machine = request.machineNumber ? normalize(request.machineNumber) : "";
    const freeText = request.freeText ? normalize(request.freeText) : "";

    let matches = mockMastercards.filter((mc) => {
      if (part && normalize(mc.partNumber) !== part) return false;
      if (mold && normalize(mc.moldBaseNumber) !== mold) return false;
      if (machine && !request.includeComparable && normalize(mc.machineNumber) !== machine) return false;
      if (request.sourceFolder && request.sourceFolder !== "all" && !mc.sourceFolder.includes(request.sourceFolder)) {
        return false;
      }
      if (request.validationStatus && request.validationStatus !== "all" && mc.validationStatus !== request.validationStatus) {
        return false;
      }
      return true;
    });

    if (freeText) {
      matches = mockMastercards.filter(
        (mc) =>
          normalize(mc.partNumber).includes(freeText) ||
          normalize(mc.filePath).includes(freeText) ||
          normalize(mc.moldBaseNumber).includes(freeText),
      );
    }

    return delay({ matches, matchType: classifyMatches(matches) }, 450);
  },

  async validateMastercard(filePath: string): Promise<ValidationResult> {
    const mastercard = mockMastercards.find((mc) => mc.filePath === filePath);
    const existing = mastercard ? mockValidationResults[mastercard.id] : undefined;
    if (existing) return delay(existing, 600);
    // Fall back to a clean PASS for any Mastercard that has no seeded
    // validation history, so validating something not pre-scripted still
    // produces a sensible result rather than an error.
    return delay(
      {
        id: `val-${Date.now()}`,
        mastercardId: mastercard?.id ?? "unknown",
        overall: "PASS",
        printingBlocked: false,
        timestamp: new Date().toISOString(),
        rules: [
          {
            ruleId: "PART_MOLD_MACHINE_CONSISTENCY",
            worksheet: "Repro",
            cell: "C3",
            currentValue: `${mastercard?.partNumber ?? ""} / MB${mastercard?.moldBaseNumber ?? ""} / MA${mastercard?.machineNumber ?? ""}`,
            explanation: "Part, mold, and machine are consistent across the workbook and filename.",
            severity: "PASS",
            printingBlocked: false,
          },
        ],
      },
      600,
    );
  },

  async preparePrint(filePath: string): Promise<PrintQueueItem> {
    const mastercard = mockMastercards.find((mc) => mc.filePath === filePath) ?? mockMastercards[0];
    const validationResult = mockValidationResults[mastercard.id] ?? null;
    const blocked = validationResult?.printingBlocked ?? false;
    return delay(
      {
        id: `pq-${Date.now()}`,
        mastercard,
        validationResult,
        printer: "USB6S00DPTQ060",
        copies: 1,
        sheets: mastercard.fileType === "pdf" ? 1 : 2,
        dryRun: true,
        status: blocked ? "Blocked" : "Confirmation Required",
        requestedAt: new Date().toISOString(),
      },
      500,
    );
  },

  async confirmPrint(item: PrintQueueItem): Promise<PrintQueueItem> {
    if (item.status === "Blocked") {
      return delay(item, 300);
    }
    return delay({ ...item, status: "Print Command Accepted" }, 700);
  },

  async logPrintedMastercard(item: PrintQueueItem): Promise<{ success: boolean; message: string }> {
    if (item.status !== "Print Command Accepted") {
      return delay(
        { success: false, message: "No successful print command on record for this file." },
        300,
      );
    }
    return delay({ success: true, message: `Logged to OnFloor.` }, 500);
  },

  async refreshIndex(): Promise<IndexStatus> {
    return delay(
      { ...mockIndexStatus, lastUpdated: new Date().toISOString() },
      1200,
    );
  },

  async getIndexStatus(): Promise<IndexStatus> {
    return delay(mockIndexStatus, 150);
  },

  async getOllamaStatus(): Promise<OllamaStatus> {
    return delay(mockOllamaStatus, 150);
  },

  async getAuditHistory(): Promise<AuditEntry[]> {
    return delay(mockAuditHistory, 250);
  },

  async getRecoveryQueue(): Promise<RecoveryRecord[]> {
    return delay(mockRecoveryRecords, 250);
  },

  async getOnFloorRecords(): Promise<OnFloorRecord[]> {
    return delay(mockOnFloorRecords, 250);
  },
};

export type BackendBridge = typeof backendBridge;
