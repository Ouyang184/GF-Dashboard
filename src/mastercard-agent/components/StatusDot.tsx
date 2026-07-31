import { cn } from "@/lib/utils";
import type { StatusColor } from "../types";

const COLOR_CLASSES: Record<StatusColor, string> = {
  green: "bg-success shadow-[0_0_6px_var(--success)]",
  blue: "bg-primary shadow-[0_0_6px_var(--primary)]",
  yellow: "bg-warning shadow-[0_0_6px_var(--warning)]",
  red: "bg-danger shadow-[0_0_6px_var(--danger)]",
  gray: "bg-muted-foreground/50",
};

interface StatusDotProps {
  color: StatusColor;
  pulse?: boolean;
  className?: string;
}

export function StatusDot({ color, pulse, className }: StatusDotProps) {
  return (
    <span
      className={cn("inline-block size-2.5 rounded-full", COLOR_CLASSES[color], pulse && "animate-pulse", className)}
      aria-hidden
    />
  );
}
