import { describe, expect, it } from "vitest";
import { fullDateTime, relativeDay } from "./activity";

describe("relativeDay", () => {
  const now = new Date("2026-11-04T10:00:00Z"); // 13:00 in Riyadh

  it("says today and yesterday by calendar day in Riyadh", () => {
    expect(relativeDay("2026-11-04T01:00:00Z", now)).toBe("Today");
    // 3 Nov 22:00 UTC is already 4 Nov in Riyadh.
    expect(relativeDay("2026-11-03T22:00:00Z", now)).toBe("Today");
    expect(relativeDay("2026-11-03T08:00:00Z", now)).toBe("Yesterday");
  });

  it("counts days within a fortnight", () => {
    expect(relativeDay("2026-11-01T08:00:00Z", now)).toBe("3 days ago");
    expect(relativeDay("2026-10-22T08:00:00Z", now)).toBe("13 days ago");
  });

  it("shows a short date after that, with the year only when it differs", () => {
    expect(relativeDay("2026-10-12T08:00:00Z", now)).toBe("12 Oct");
    expect(relativeDay("2025-10-12T08:00:00Z", now)).toBe("12 Oct 2025");
  });

  it("treats future timestamps as today and rejects invalid input", () => {
    expect(relativeDay("2026-11-05T08:00:00Z", now)).toBe("Today");
    expect(relativeDay("not a date", now)).toBe("Unknown");
    expect(fullDateTime("not a date")).toBe("");
  });
});
