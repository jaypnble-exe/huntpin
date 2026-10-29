import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

const BASE = {
  MAX_RESULTS_PER_SEARCH: "10",
  MAX_PLACES_REQUESTS_PER_MONTH: "10",
};

describe("loadConfig", () => {
  it("is disabled with the ids_only tier by default", () => {
    const result = loadConfig(BASE);
    expect(result).toEqual({
      ok: true,
      config: {
        placesSearchEnabled: false,
        googleMapsApiKey: null,
        maxResultsPerSearch: 10,
        maxPlacesRequestsPerMonth: 10,
        fieldTier: "ids_only",
      },
    });
  });

  it("only enables search for the exact value 'true'", () => {
    for (const value of ["1", "yes", "on"]) {
      expect(loadConfig({ ...BASE, PLACES_SEARCH_ENABLED: value, GOOGLE_MAPS_API_KEY: "k" }).ok).toBe(false);
    }
    const enabled = loadConfig({ ...BASE, PLACES_SEARCH_ENABLED: "true", GOOGLE_MAPS_API_KEY: "k" });
    expect(enabled.ok && enabled.config.placesSearchEnabled).toBe(true);
  });

  it("fails closed when safety limits are missing", () => {
    const result = loadConfig({});
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual([
      "MAX_RESULTS_PER_SEARCH is required",
      "MAX_PLACES_REQUESTS_PER_MONTH is required",
    ]);
  });

  it("rejects limits above the code-level ceilings", () => {
    expect(loadConfig({ ...BASE, MAX_RESULTS_PER_SEARCH: "11" }).ok).toBe(false);
    expect(loadConfig({ ...BASE, MAX_PLACES_REQUESTS_PER_MONTH: "101" }).ok).toBe(false);
    expect(loadConfig({ ...BASE, MAX_RESULTS_PER_SEARCH: "0" }).ok).toBe(false);
    expect(loadConfig({ ...BASE, MAX_RESULTS_PER_SEARCH: "5.5" }).ok).toBe(false);
    expect(loadConfig({ ...BASE, MAX_PLACES_REQUESTS_PER_MONTH: "-1" }).ok).toBe(false);
  });

  it("requires an API key when enabled", () => {
    const result = loadConfig({ ...BASE, PLACES_SEARCH_ENABLED: "true" });
    expect(result.ok).toBe(false);
  });

  it("rejects unknown field tiers", () => {
    expect(loadConfig({ ...BASE, PLACES_FIELD_TIER: "enterprise" }).ok).toBe(false);
    const pro = loadConfig({ ...BASE, PLACES_FIELD_TIER: "pro" });
    expect(pro.ok && pro.config.fieldTier).toBe("pro");
  });

  it("never includes the API key in error messages", () => {
    const result = loadConfig({ PLACES_SEARCH_ENABLED: "maybe", GOOGLE_MAPS_API_KEY: "SECRET-KEY" });
    expect(JSON.stringify(result)).not.toContain("SECRET-KEY");
  });
});
