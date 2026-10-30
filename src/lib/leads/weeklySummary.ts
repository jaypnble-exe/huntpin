// Weekly summary of outreach activity, computed from saved leads.
import { addDays, isDue, localDate, wantsFollowUp } from "./followUps";
import { LEAD_STATUSES, type LeadStatus } from "./leads";

export interface SummaryLead {
  lead_status: LeadStatus;
  created_at: string;
  updated_at: string;
  first_contacted_at: string | null;
  last_contacted_at: string | null;
  follow_up_on: string | null;
  follow_up_count: number;
}

export interface WeeklySummary {
  from: string;
  to: string;
  thisWeek: { saved: number; firstContacts: number; followUpsSent: number; replies: number; declined: number };
  pipeline: Record<LeadStatus, number>;
  followUps: { dueNow: number; nextSevenDays: number };
  /** Share of contacted leads that replied, 0–1, or null before any contact. */
  replyRate: number | null;
  totalLeads: number;
}

export function computeWeeklySummary(leads: SummaryLead[], now: Date, timeZone?: string): WeeklySummary {
  const today = localDate(now, timeZone);
  const from = addDays(today, -6);
  const inWeek = (timestamp: string | null) => {
    if (!timestamp) return false;
    const day = localDate(new Date(timestamp), timeZone);
    return day >= from && day <= today;
  };

  const pipeline = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const lead of leads) pipeline[lead.lead_status] += 1;

  const contacted = leads.filter((l) => l.first_contacted_at !== null);
  const replied = contacted.filter((l) => l.lead_status === "replied").length;
  const nextWeek = addDays(today, 7);

  return {
    from,
    to: today,
    thisWeek: {
      saved: leads.filter((l) => inWeek(l.created_at)).length,
      firstContacts: leads.filter((l) => inWeek(l.first_contacted_at)).length,
      followUpsSent: leads.filter(
        (l) => l.follow_up_count > 0 && inWeek(l.last_contacted_at) && l.last_contacted_at !== l.first_contacted_at,
      ).length,
      replies: leads.filter((l) => l.lead_status === "replied" && inWeek(l.updated_at)).length,
      declined: leads.filter(
        (l) => (l.lead_status === "not_interested" || l.lead_status === "do_not_contact") && inWeek(l.updated_at),
      ).length,
    },
    pipeline,
    followUps: {
      dueNow: leads.filter((l) => isDue(l.follow_up_on, l.lead_status, today)).length,
      nextSevenDays: leads.filter(
        (l) => l.follow_up_on !== null && wantsFollowUp(l.lead_status) && l.follow_up_on > today && l.follow_up_on <= nextWeek,
      ).length,
    },
    replyRate: contacted.length > 0 ? replied / contacted.length : null,
    totalLeads: leads.length,
  };
}
