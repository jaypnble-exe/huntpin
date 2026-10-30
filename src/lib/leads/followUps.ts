// Follow-up reminders. Respectful by design: a fixed gap between messages, a
// small maximum, and no reminders for leads that replied, declined or opted out.
import type { LeadStatus } from "./leads";

export const FOLLOW_UP_AFTER_DAYS = 4;
export const MAX_FOLLOW_UPS = 2;
/** Operator's time zone for "today". Override with APP_TIME_ZONE. */
export const DEFAULT_TIME_ZONE = "Asia/Riyadh";

/** Statuses that keep (or get) a follow-up reminder. */
const FOLLOW_UP_STATUSES: readonly LeadStatus[] = ["contacted", "follow_up"];

export function wantsFollowUp(status: LeadStatus): boolean {
  return FOLLOW_UP_STATUSES.includes(status);
}

/** YYYY-MM-DD for `now` in the given time zone. */
export function localDate(now: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ContactState {
  status: LeadStatus;
  firstContactedAt: string | null;
  followUpCount: number;
}

/**
 * What "Mark contacted today" changes. The first contact moves a new or
 * reviewed lead to "contacted"; later contacts count as follow-ups. A
 * reminder is set until MAX_FOLLOW_UPS have been sent.
 */
export function afterContact(
  current: ContactState,
  { now, timeZone, explicitStatus }: { now: Date; timeZone?: string; explicitStatus?: LeadStatus },
): { status: LeadStatus; followUpCount: number; followUpOn: string | null; isFollowUp: boolean } {
  const isFollowUp = current.firstContactedAt !== null;
  const followUpCount = isFollowUp ? current.followUpCount + 1 : current.followUpCount;
  const status =
    explicitStatus ??
    (current.status === "new" || current.status === "reviewed" ? "contacted" : isFollowUp ? "follow_up" : current.status);
  const followUpOn =
    wantsFollowUp(status) && followUpCount < MAX_FOLLOW_UPS ? addDays(localDate(now, timeZone), FOLLOW_UP_AFTER_DAYS) : null;
  return { status, followUpCount, followUpOn, isFollowUp };
}

export function isDue(followUpOn: string | null, status: LeadStatus, today: string): boolean {
  return followUpOn !== null && wantsFollowUp(status) && followUpOn <= today;
}
