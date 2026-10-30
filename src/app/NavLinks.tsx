"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const LINKS = [
  { href: "/", label: "Map" },
  { href: "/leads", label: "Leads" },
  { href: "/queue", label: "Outreach" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/templates", label: "Templates" },
  { href: "/summary", label: "Summary" },
  { href: "/google", label: "Google search" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-1 overflow-x-auto text-sm">
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 font-medium whitespace-nowrap transition-colors",
              active ? "bg-surface-muted text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
