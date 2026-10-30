import { describe, expect, it } from "vitest";
import { computeWeeklySummary, type SummaryLead } from "./weeklySummary";

const NOW = new Date("2026-10-30T10:00:00Z"); // 30 Oct in Riyadh
const base: SummaryLead = {
  lead_status: "new",
  created_at: "2026-10-29T09:00:00Z",
  updated_at: "2026-10-29T09:00:00Z",
  first_contacted_at: null,
  last_contacted_at: null,
  follow_up_on: null,
  follow_up_count: 0,
};

describe("computeWeeklySummary", () => {
  it("counts this week's activity, pipeline and follow-ups", () => {
    const leads: SummaryLead[] = [
      base,
      { ...base, created_at: "2026-10-01T09:00:00Z" }, // saved before this week
      {
        ...base,
        lead_status: "contacted",
        first_contacted_at: "2026-10-28T09:00:00Z",
        last_contacted_at: "2026-10-28T09:00:00Z",
        follow_up_on: "2026-10-30",
      },
      {
        ...base,
        lead_status: "follow_up",
        first_contacted_at: "2026-10-20T09:00:00Z",
        last_contacted_at: "2026-10-29T09:00:00Z",
        follow_up_count: 1,
        follow_up_on: "2026-11-02",
      },
      {
        ...base,
        lead_status: "replied",
        first_contacted_at: "2026-10-21T09:00:00Z",
        last_contacted_at: "2026-10-21T09:00:00Z",
        updated_at: "2026-10-27T09:00:00Z",
      },
      { ...base, lead_status: "do_not_contact", first_contacted_at: "2026-10-22T09:00:00Z", updated_at: "2026-10-30T08:00:00Z" },
    ];
    expect(computeWeeklySummary(leads, NOW)).toEqual({
      from: "2026-10-24",
      to: "2026-10-30",
      thisWeek: { saved: 5, firstContacts: 1, followUpsSent: 1, replies: 1, declined: 1 },
      pipeline: { new: 2, reviewed: 0, contacted: 1, replied: 1, follow_up: 1, meeting: 0, proposal_sent: 0, won: 0, lost: 0, not_interested: 0, do_not_contact: 1, not_a_fit: 0 },
      followUps: { dueNow: 1, nextSevenDays: 1 },
      replyRate: 0.25,
      totalLeads: 6,
    });
  });

  it("has no reply rate before any contact", () => {
    expect(computeWeeklySummary([base], NOW).replyRate).toBeNull();
    expect(computeWeeklySummary([], NOW).totalLeads).toBe(0);
  });
});
