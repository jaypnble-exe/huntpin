import { describe, expect, it } from "vitest";
import { listingFreshness, staleBefore } from "./freshness";

const today = new Date("2026-11-04T12:00:00Z");
const base = { confidence: null, operating_status: null, refreshed_on: null };

describe("listing freshness", () => {
  it("uses Foursquare's last update and flags listings over a year old", () => {
    expect(listingFreshness({ ...base, refreshed_on: "2026-03-10" }, today)).toEqual({ label: "Listing updated Mar 2026", stale: false });
    expect(listingFreshness({ ...base, refreshed_on: "2025-06-01" }, today)).toEqual({ label: "Listing updated Jun 2025", stale: true });
  });

  it("falls back to Overture's existence score", () => {
    expect(listingFreshness({ ...base, confidence: 0.81 }, today)).toEqual({ label: "Still exists: 81%", stale: false });
    expect(listingFreshness({ ...base, confidence: 0.42 }, today)?.stale).toBe(true);
  });

  it("flags places the data marks as not open, and says nothing without data", () => {
    expect(listingFreshness({ ...base, confidence: 0.9, operating_status: "temporarily_closed" }, today)).toEqual({
      label: "Data says temporarily closed",
      stale: true,
    });
    expect(listingFreshness({ ...base, operating_status: "open" }, today)).toBeNull();
    expect(listingFreshness(base, today)).toBeNull();
  });

  it("computes the cut-off for the last-year filter", () => {
    expect(staleBefore(today)).toBe("2025-11-04");
  });
});
