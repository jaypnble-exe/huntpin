import { PRESENCE_STYLES } from "@/app/placeStyles";
import { Badge, cn, type BadgeTone } from "@/components/ui";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/leads/leads";
import type { WebPresence } from "@/lib/places/webPresence";

/** 0–100 lead score; colour shows strength at a glance. */
export function ScorePill({ score, className }: { score: number; className?: string }) {
  const tone =
    score >= 70
      ? "bg-success text-white dark:text-black"
      : score >= 40
        ? "bg-warning-soft text-warning border border-warning/30"
        : "bg-surface-muted text-muted border border-border";
  return (
    <span
      title={`Lead score ${score}/100`}
      className={cn("inline-flex h-6 min-w-9 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums", tone, className)}
    >
      {score}
    </span>
  );
}

const STATUS_TONES: Record<LeadStatus, BadgeTone> = {
  new: "info",
  reviewed: "neutral",
  contacted: "warning",
  follow_up: "warning",
  replied: "success",
  meeting: "info",
  proposal_sent: "pink",
  won: "brand",
  lost: "neutral",
  not_interested: "neutral",
  do_not_contact: "danger",
  not_a_fit: "neutral",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}

export function PresenceBadge({ presence }: { presence: WebPresence }) {
  const style = PRESENCE_STYLES[presence];
  return (
    <Badge dot={style.color} tone="neutral" className="text-foreground">
      {style.label}
    </Badge>
  );
}

export const WEBSITE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  reachable: { label: "Reachable", tone: "success" },
  unreachable: { label: "Unreachable", tone: "danger" },
  needs_manual_review: { label: "Needs review", tone: "warning" },
  not_listed: { label: "No URL listed", tone: "neutral" },
};

export function WebsiteStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted">Not checked</span>;
  const info = WEBSITE_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={info.tone}>{info.label}</Badge>;
}

export function InstagramBadge() {
  return <Badge tone="pink">Instagram</Badge>;
}
