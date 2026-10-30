import type { ReactNode } from "react";
import { cn } from "./cn";

type AlertTone = "info" | "warning" | "danger" | "success";

const ALERT_TONES: Record<AlertTone, string> = {
  info: "border-info/25 bg-info-soft",
  warning: "border-warning/30 bg-warning-soft",
  danger: "border-danger/30 bg-danger-soft",
  success: "border-success/30 bg-success-soft",
};

export function Alert({
  tone = "info",
  title,
  className,
  children,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn("rounded-xl border p-4 text-sm", ALERT_TONES[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(Boolean(title) && "mt-1", "text-foreground/90")}>{children}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed border-border-strong bg-surface p-8 text-center", className)}>
      <p className="font-medium">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-muted", className)}>
      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-border-strong border-t-primary" />
      {label}
    </span>
  );
}

/** Inline result message after an action (saved, copied, failed...). */
export function InlineMessage({ tone, children }: { tone: "success" | "danger" | "muted"; children: ReactNode }) {
  return (
    <span
      role={tone === "danger" ? "alert" : "status"}
      className={cn("text-xs", tone === "success" && "text-success", tone === "danger" && "text-danger", tone === "muted" && "text-muted")}
    >
      {children}
    </span>
  );
}
