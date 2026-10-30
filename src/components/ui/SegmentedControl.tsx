"use client";

import { cn } from "./cn";

/** A small set of mutually exclusive options, shown as joined buttons. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex rounded-lg border border-border bg-surface-muted p-0.5", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => !selected && onChange(option.value)}
            className={cn(
              "rounded-md font-medium transition-colors",
              size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
              selected ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** On/off pill, e.g. for filter chips. */
export function ToggleChip({
  pressed,
  onToggle,
  dot,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        pressed
          ? "border-primary/40 bg-info-soft text-foreground"
          : "border-border bg-surface text-muted hover:text-foreground",
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("h-2.5 w-2.5 rounded-full", !pressed && "opacity-40")}
          style={{ background: dot }}
        />
      )}
      {children}
    </button>
  );
}
