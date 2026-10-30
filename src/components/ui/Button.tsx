import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
  secondary: "border border-border-strong bg-surface text-foreground hover:bg-surface-muted shadow-sm",
  ghost: "text-foreground hover:bg-surface-muted",
  danger: "text-danger hover:bg-danger-soft",
  success: "border border-success/50 bg-success-soft text-success hover:border-success",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-md px-2.5 text-xs",
  md: "h-9 gap-2 rounded-lg px-3.5 text-sm",
};

/** Shared button styles; also used for links that look like buttons. */
export function buttonClasses({
  variant = "secondary",
  size = "md",
  active = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; active?: boolean; className?: string } = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    active && "ring-2 ring-primary/40",
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; active?: boolean };

export function Button({ variant, size, active, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, active, className })} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}

type ExternalButtonLinkProps = ComponentProps<"a"> & { variant?: ButtonVariant; size?: ButtonSize };

/** External link styled as a button; opens in a new tab. */
export function ExternalButtonLink({ variant, size, className, children, ...props }: ExternalButtonLinkProps) {
  return (
    <a target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant, size, className })} {...props}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
