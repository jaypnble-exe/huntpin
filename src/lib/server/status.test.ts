import { describe, expect, it } from "vitest";
import { searchBlockedReason } from "./status";

const READY = {
  configOk: true,
  configErrors: [],
  searchEnabled: true,
  trackingAvailable: true,
  paused: false,
  fieldTier: "ids_only" as const,
  sku: "Text Search Essentials (IDs Only)",
  googleFreeMonthlyCap: "unlimited",
  used: 3,
  limit: 10,
  remaining: 7,
  maxResultsPerSearch: 10,
};

describe("searchBlockedReason", () => {
  it("allows search only when every safeguard passes", () => {
    expect(searchBlockedReason(READY)).toBeNull();
  });

  it.each([
    [{ configOk: false }, /configuration/],
    [{ trackingAvailable: false }, /tracking/],
    [{ searchEnabled: false }, /disabled/],
    [{ paused: true }, /paused/],
    [{ remaining: 0 }, /limit/],
    [{ remaining: null }, /limit/],
  ])("blocks when %o", (override, reason) => {
    expect(searchBlockedReason({ ...READY, ...override })).toMatch(reason);
  });
});
