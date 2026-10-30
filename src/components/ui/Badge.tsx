import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "pink" | "brand";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-muted border-border",
  info: "bg-info-soft text-info border-info/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/20",
  pink: "bg-pink-soft text-pink border-pink/20",
  brand: "bg-primary text-primary-foreground border-primary",
};

/** Small status label. `dot` shows a coloured dot (e.g. a map pin colour). */
export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />}
      {children}
    </span>
  );
}
