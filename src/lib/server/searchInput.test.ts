import { describe, expect, it } from "vitest";
import { validateSearchInput } from "./searchInput";

const VALID = { niche: "restaurants", location: "Jeddah, Saudi Arabia", maxResults: 10, confirmed: true };

describe("validateSearchInput", () => {
  it("accepts and normalizes a valid request", () => {
    expect(validateSearchInput({ ...VALID, niche: "  cafés   and  bakeries " }, 10)).toEqual({
      ok: true,
      input: { ...VALID, niche: "cafés and bakeries" },
    });
  });

  it("rejects maxResults above the configured limit instead of clamping", () => {
    expect(validateSearchInput({ ...VALID, maxResults: 11 }, 10).ok).toBe(false);
    expect(validateSearchInput({ ...VALID, maxResults: 6 }, 5).ok).toBe(false);
    expect(validateSearchInput({ ...VALID, maxResults: 0 }, 10).ok).toBe(false);
    expect(validateSearchInput({ ...VALID, maxResults: 2.5 }, 10).ok).toBe(false);
    expect(validateSearchInput({ ...VALID, maxResults: "10" }, 10).ok).toBe(false);
  });

  it("rejects too-short, too-long, and non-string text", () => {
    expect(validateSearchInput({ ...VALID, niche: "a" }, 10).ok).toBe(false);
    expect(validateSearchInput({ ...VALID, niche: "x".repeat(61) }, 10).ok).toBe(false);
    expect(validateSearchInput({ ...VALID, location: "y".repeat(81) }, 10).ok).toBe(false);
    expect(validateSearchInput({ ...VALID, location: 42 }, 10).ok).toBe(false);
  });

  it("rejects control characters", () => {
    expect(validateSearchInput({ ...VALID, niche: "cafes\nDROP" }, 10).ok).toBe(false);
  });

  it("rejects unknown fields and non-object bodies", () => {
    expect(validateSearchInput({ ...VALID, pageToken: "abc" }, 10).ok).toBe(false);
    expect(validateSearchInput([VALID], 10).ok).toBe(false);
    expect(validateSearchInput(null, 10).ok).toBe(false);
  });

  it("treats a missing confirmation as unconfirmed", () => {
    const { confirmed: _, ...unconfirmed } = VALID;
    const result = validateSearchInput(unconfirmed, 10);
    expect(result.ok && result.input.confirmed).toBe(false);
  });
});
