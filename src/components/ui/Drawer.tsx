"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn";
import { IconX } from "./icons";

/**
 * Side panel on wide screens, bottom sheet on phones. Non-modal: the page
 * behind stays usable. Escape closes it; focus moves to the panel on open.
 * With `dismissOnOutsideClick`, pressing anywhere outside the panel closes it.
 */
export function Drawer({
  label,
  title,
  subtitle,
  onClose,
  position = "fixed",
  dismissOnOutsideClick = false,
  className,
  children,
}: {
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  /** "absolute" positions inside a relative container (e.g. the map). */
  position?: "fixed" | "absolute";
  dismissOnOutsideClick?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!dismissOnOutsideClick) return;
    const onPointerDown = (event: PointerEvent) => {
      // Only the main (left) button; ignore clicks inside the panel and on
      // elements removed from the page meanwhile.
      if (event.button !== 0) return;
      const target = event.target as Node | null;
      if (!target || !target.isConnected || ref.current?.contains(target)) return;
      onCloseRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [dismissOnOutsideClick]);

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label={label}
      className={cn(
        position,
        "inset-x-0 bottom-0 z-30 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-border bg-surface text-foreground shadow-2xl focus:outline-none",
        position === "fixed"
          ? // Below the 3rem sticky app header.
            "sm:top-12 sm:right-0 sm:bottom-0 sm:left-auto sm:max-h-none sm:w-[30rem] sm:rounded-none sm:border-y-0 sm:border-r-0"
          : "sm:inset-x-auto sm:top-3 sm:right-14 sm:bottom-auto sm:max-h-[calc(100%-1.5rem)] sm:w-[25rem] sm:rounded-2xl",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-lg leading-snug font-semibold" dir="auto">
            {title}
          </h2>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${label.toLowerCase()}`}
          className="-mr-1 rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
        >
          <IconX />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </aside>
  );
}
