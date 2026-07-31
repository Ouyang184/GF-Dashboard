import { cn } from "@/lib/utils";
import type { MatchType, ValidationSeverity } from "../types";

const MATCH_TYPE_CLASSES: Record<MatchType, string> = {
  Exact: "border-success/40 bg-success/10 text-success",
  Comparable: "border-primary/40 bg-primary/10 text-primary",
  "Process Sheet": "border-muted-foreground/30 bg-muted text-muted-foreground",
  Multiple: "border-warning/40 bg-warning/10 text-warning",
  Missing: "border-danger/40 bg-danger/10 text-danger",
  Stale: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

const VALIDATION_CLASSES: Record<ValidationSeverity | "unknown", string> = {
  PASS: "border-success/40 bg-success/10 text-success",
  WARNING: "border-warning/40 bg-warning/10 text-warning",
  FAIL: "border-danger/40 bg-danger/10 text-danger",
  unknown: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

function badgeClasses(className?: string) {
  return cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap", className);
}

export function MatchTypeBadge({ matchType, className }: { matchType: MatchType; className?: string }) {
  return <span className={badgeClasses(cn(MATCH_TYPE_CLASSES[matchType], className))}>{matchType}</span>;
}

export function ValidationBadge({
  severity,
  className,
}: {
  severity: ValidationSeverity | "unknown";
  className?: string;
}) {
  return (
    <span className={badgeClasses(cn(VALIDATION_CLASSES[severity], className))}>
      {severity === "unknown" ? "Not validated" : severity}
    </span>
  );
}
