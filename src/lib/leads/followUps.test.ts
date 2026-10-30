import { describe, expect, it } from "vitest";
import { addDays, afterContact, isDue, localDate, MAX_FOLLOW_UPS } from "./followUps";

// 22:30 UTC on 30 Oct is already 31 Oct in Riyadh (UTC+3).
const NOW = new Date("2026-10-30T22:30:00Z");

describe("dates", () => {
  it("uses the operator's time zone for today", () => {
    expect(localDate(NOW)).toBe("2026-10-31");
    expect(localDate(NOW, "UTC")).toBe("2026-10-30");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-10-30", 4)).toBe("2026-11-03");
  });
});

describe("afterContact", () => {
  it("first contact: new becomes contacted with a reminder in 4 days", () => {
    expect(afterContact({ status: "new", firstContactedAt: null, followUpCount: 0 }, { now: NOW })).toEqual({
      status: "contacted",
      followUpCount: 0,
      followUpOn: "2026-11-04",
      isFollowUp: false,
    });
  });

  it("follow-ups count up and stop reminding at the maximum", () => {
    const first = afterContact({ status: "contacted", firstContactedAt: "2026-10-20T10:00:00Z", followUpCount: 0 }, { now: NOW });
    expect(first).toMatchObject({ status: "follow_up", followUpCount: 1, followUpOn: "2026-11-04", isFollowUp: true });

    const last = afterContact({ status: "follow_up", firstContactedAt: "2026-10-20T10:00:00Z", followUpCount: MAX_FOLLOW_UPS - 1 }, { now: NOW });
    expect(last).toMatchObject({ followUpCount: MAX_FOLLOW_UPS, followUpOn: null });
  });

  it("never sets reminders for replied, declined or opted-out leads", () => {
    for (const status of ["replied", "not_interested", "do_not_contact"] as const) {
      expect(afterContact({ status: "new", firstContactedAt: null, followUpCount: 0 }, { now: NOW, explicitStatus: status }).followUpOn).toBeNull();
    }
  });
});

describe("isDue", () => {
  it("is due on or after the date, only for contacted or follow-up leads", () => {
    expect(isDue("2026-10-31", "contacted", "2026-10-31")).toBe(true);
    expect(isDue("2026-10-30", "follow_up", "2026-10-31")).toBe(true);
    expect(isDue("2026-11-01", "contacted", "2026-10-31")).toBe(false);
    expect(isDue("2026-10-30", "replied", "2026-10-31")).toBe(false);
    expect(isDue(null, "contacted", "2026-10-31")).toBe(false);
  });
});
