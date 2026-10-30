import { describe, expect, it } from "vitest";
import { computePipelineStats, daysSince, formatMoney, neighbourStages } from "./pipeline";

describe("computePipelineStats", () => {
  const now = new Date("2026-10-30T10:00:00Z");
  it("totals open deals, wins this month and the win rate", () => {
    const stats = computePipelineStats(
      [
        { lead_status: "replied", deal_value: null, closed_at: null },
        { lead_status: "meeting", deal_value: 3000, closed_at: null },
        { lead_status: "proposal_sent", deal_value: 4500.5, closed_at: null },
        { lead_status: "won", deal_value: 6000, closed_at: "2026-10-05T09:00:00Z" },
        // 30 Sep 22:00 UTC is already 1 Oct in Riyadh.
        { lead_status: "won", deal_value: 1000, closed_at: "2026-09-30T22:00:00Z" },
        { lead_status: "won", deal_value: 2000, closed_at: "2026-09-10T09:00:00Z" },
        { lead_status: "lost", deal_value: 9000, closed_at: "2026-10-01T09:00:00Z" },
        { lead_status: "contacted", deal_value: 100, closed_at: null },
      ],
      now,
    );
    expect(stats).toEqual({
      openValue: 7500.5,
      openCount: 3,
      wonThisMonthValue: 7000,
      wonThisMonthCount: 2,
      wonValue: 9000,
      wonCount: 3,
      lostCount: 1,
      winRate: 0.75,
    });
  });

  it("has no win rate before any deal closes", () => {
    expect(computePipelineStats([], now).winRate).toBeNull();
  });
});

describe("board helpers", () => {
  it("moves through the stages in order", () => {
    expect(neighbourStages("replied")).toEqual({ previous: null, next: ["meeting"] });
    expect(neighbourStages("proposal_sent")).toEqual({ previous: "meeting", next: ["won", "lost"] });
    expect(neighbourStages("lost")).toEqual({ previous: "proposal_sent", next: [] });
  });

  it("counts whole days and formats money", () => {
    expect(daysSince("2026-10-27T11:00:00Z", new Date("2026-10-30T10:00:00Z"))).toBe(2);
    expect(formatMoney(12500.4, "SAR")).toBe("12,500 SAR");
  });
});
