import type { IndexStatus, Operation, PendingConfirmation, StatusColor } from "../types";

export interface AgentStatus {
  color: StatusColor;
  label: string;
}

export function deriveAgentStatus(args: {
  indexStatus: IndexStatus;
  currentOperation: Operation | null;
  pendingConfirmation: PendingConfirmation | null;
}): AgentStatus {
  const { indexStatus, currentOperation, pendingConfirmation } = args;

  if (indexStatus.stale) {
    return { color: "gray", label: "Index stale -- network unavailable" };
  }
  if (currentOperation?.status === "failed") {
    return { color: "red", label: "Last operation failed" };
  }
  if (pendingConfirmation) {
    return { color: "yellow", label: "Confirmation required" };
  }
  if (currentOperation?.status === "running") {
    return { color: "blue", label: currentOperation.label };
  }
  return { color: "green", label: "Ready" };
}
