import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-border bg-surface shadow-sm", className)} {...props} />;
}

/** Titled section inside a card or drawer. */
export function Section({
  title,
  description,
  actions,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={className}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={id} className="text-sm font-semibold">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "danger" | "success";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <dt className="text-xs font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "danger" && "text-danger",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
