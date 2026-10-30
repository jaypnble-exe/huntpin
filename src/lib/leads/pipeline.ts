// Deal pipeline after a reply: stage columns and money totals.
import { localDate } from "./followUps";
import { DEAL_STAGES, type DealStage, type LeadStatus } from "./leads";

export interface PipelineLead {
  lead_status: LeadStatus;
  deal_value: number | null;
  closed_at: string | null;
}

export interface PipelineStats {
  /** Value of deals still open (replied, meeting, proposal sent). */
  openValue: number;
  openCount: number;
  wonThisMonthValue: number;
  wonThisMonthCount: number;
  wonValue: number;
  wonCount: number;
  lostCount: number;
  /** Won / (won + lost), or null before any deal is closed. */
  winRate: number | null;
}

const OPEN_STAGES: readonly DealStage[] = ["replied", "meeting", "proposal_sent"];

export function computePipelineStats(leads: PipelineLead[], now: Date, timeZone?: string): PipelineStats {
  const month = localDate(now, timeZone).slice(0, 7);
  const open = leads.filter((l) => OPEN_STAGES.includes(l.lead_status as DealStage));
  const won = leads.filter((l) => l.lead_status === "won");
  const wonThisMonth = won.filter((l) => l.closed_at && localDate(new Date(l.closed_at), timeZone).slice(0, 7) === month);
  const lostCount = leads.filter((l) => l.lead_status === "lost").length;
  const sum = (list: PipelineLead[]) => Math.round(list.reduce((total, l) => total + (l.deal_value ?? 0), 0) * 100) / 100;
  return {
    openValue: sum(open),
    openCount: open.length,
    wonThisMonthValue: sum(wonThisMonth),
    wonThisMonthCount: wonThisMonth.length,
    wonValue: sum(won),
    wonCount: won.length,
    lostCount,
    winRate: won.length + lostCount > 0 ? won.length / (won.length + lostCount) : null,
  };
}

/** The stage before / after this one on the board (won and lost are both last). */
export function neighbourStages(stage: DealStage): { previous: DealStage | null; next: DealStage[] } {
  switch (stage) {
    case "replied":
      return { previous: null, next: ["meeting"] };
    case "meeting":
      return { previous: "replied", next: ["proposal_sent"] };
    case "proposal_sent":
      return { previous: "meeting", next: ["won", "lost"] };
    default:
      return { previous: "proposal_sent", next: [] };
  }
}

/** Whole days since a timestamp. */
export function daysSince(timestamp: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(timestamp).getTime()) / 86_400_000));
}

export function formatMoney(value: number, currency: string): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} ${currency}`;
}

export { DEAL_STAGES };
