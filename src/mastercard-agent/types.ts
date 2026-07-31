export type DisplayMode = "mini" | "floating" | "fullscreen";

export type WorkspacePage =
  | "chat"
  | "search"
  | "validation"
  | "print-queue"
  | "onfloor-logging"
  | "unlogged-prints"
  | "audit-history"
  | "recovery-queue"
  | "settings";

export type MatchType =
  | "Exact"
  | "Comparable"
  | "Process Sheet"
  | "Multiple"
  | "Missing"
  | "Stale";

export type ValidationSeverity = "PASS" | "WARNING" | "FAIL";

export type StatusColor = "green" | "blue" | "yellow" | "red" | "gray";

export interface Mastercard {
  id: string;
  partNumber: string;
  moldBaseNumber: string;
  machineNumber: string;
  material: string;
  processDate: string;
  sourceFolder: string;
  fileType: "xlsx" | "xlsm" | "xls" | "pdf";
  filePath: string;
  matchType: MatchType;
  validationStatus: ValidationSeverity | "unknown";
  printedStatus: boolean;
  loggedStatus: boolean;
  modifiedDate: string;
}

export interface SearchFilters {
  partNumber: string;
  moldBaseNumber: string;
  machineNumber: string;
  includeComparable: boolean;
  sourceFolder: string;
  validationStatus: string;
}

export interface SearchResult {
  id: string;
  filters: SearchFilters;
  matches: Mastercard[];
  ranAt: string;
}

export interface ValidationRuleResult {
  ruleId: string;
  worksheet: string;
  cell: string;
  currentValue: string;
  explanation: string;
  severity: ValidationSeverity;
  printingBlocked: boolean;
}

export interface ValidationResult {
  id: string;
  mastercardId: string;
  overall: ValidationSeverity;
  printingBlocked: boolean;
  timestamp: string;
  rules: ValidationRuleResult[];
}

export type PrintQueueStatus =
  | "Prepared"
  | "Confirmation Required"
  | "Blocked"
  | "Print Command Accepted"
  | "Failed";

export interface PrintQueueItem {
  id: string;
  mastercard: Mastercard;
  validationResult: ValidationResult | null;
  printer: string;
  copies: number;
  sheets: number;
  dryRun: boolean;
  status: PrintQueueStatus;
  requestedAt: string;
}

export interface PendingConfirmation {
  id: string;
  kind: "print";
  printQueueItemId: string;
  message: string;
}

export type OperationType = "search" | "validate" | "print" | "log" | "refresh-index";
export type OperationStatus = "running" | "success" | "failed" | "pending-confirmation";

export interface Operation {
  id: string;
  type: OperationType;
  label: string;
  status: OperationStatus;
}

export interface OnFloorRecord {
  id: string;
  mastercard: Mastercard;
  datePrinted: string | null;
  logStatus: "Eligible" | "Logged" | "Unlogged" | "Recovery Pending";
  matchedRow: boolean;
}

export interface RecoveryRecord {
  id: string;
  mastercard: Mastercard;
  failureReason: string;
  savedAt: string;
  retried: boolean;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userRequest: string;
  toolSelected: string;
  file: string;
  validationResult: ValidationSeverity | "n/a";
  printAction: string;
  loggingAction: string;
  outcome: "Success" | "Blocked" | "Failed" | "Cancelled";
}

export interface IndexStatus {
  fileCount: number;
  lastUpdated: string;
  stale: boolean;
  staleReason: string;
}

export interface OllamaStatus {
  connected: boolean;
  model: string;
  host: string;
}

export interface OnFloorLogAction {
  id: string;
  destination: string;
  records: Mastercard[];
}

export interface DesktopPrintAction {
  id: string;
  printer: string;
  records: Mastercard[];
}

export type ChatCard =
  | { kind: "search-results"; results: Mastercard[] }
  | { kind: "validation"; result: ValidationResult }
  | { kind: "progress"; operation: Operation; progress: number }
  | { kind: "confirmation"; confirmation: PendingConfirmation }
  | { kind: "print-status"; accepted: boolean; note: string }
  | { kind: "log-confirmation"; action: OnFloorLogAction }
  | { kind: "desktop-print-confirmation"; action: DesktopPrintAction }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | { kind: "warning"; message: string };

/**
 * A row in the activity feed. `role: "query"` is the raw text a user typed
 * (data, not dialogue). `role: "event"` is a short, terse label (e.g.
 * "SEARCH", "VALIDATE", "PRINT") -- never a scripted sentence -- with the
 * actual payload carried entirely in `cards`.
 */
export interface ChatMessage {
  id: string;
  role: "query" | "event";
  content: string;
  timestamp: string;
  cards?: ChatCard[];
}

export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowState {
  position: WindowPosition;
  size: WindowSize;
}
