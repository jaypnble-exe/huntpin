import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export const controlClasses =
  "w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-foreground shadow-xs " +
  "placeholder:text-muted/70 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 " +
  "disabled:opacity-60";

/** Label + control + optional hint, stacked. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClasses, "h-9", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlClasses, "h-9 pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClasses, "py-2 leading-relaxed", className)} {...props} />;
}

/** Checkbox with its label to the right. */
export function Checkbox({ label, className, ...props }: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-sm", className)}>
      <input type="checkbox" className="h-4 w-4 rounded" {...props} />
      <span>{label}</span>
    </label>
  );
}
