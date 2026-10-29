import { describe, expect, it } from "vitest";
import { FIELD_TIERS, fieldMaskFor } from "./fieldMasks";

// Fields that Google bills at Enterprise or Enterprise + Atmosphere.
const HIGHER_TIER_FIELDS = [
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "places.reviews",
  "places.photos",
];

describe("field masks", () => {
  it("defaults to the ID-only mask", () => {
    expect(fieldMaskFor("ids_only")).toBe("places.id");
  });

  it("pro mask is exactly id, name, and address", () => {
    expect(fieldMaskFor("pro")).toBe("places.id,places.displayName,places.formattedAddress");
  });

  it("never requests wildcards, pagination tokens, or higher-tier fields", () => {
    for (const tier of Object.values(FIELD_TIERS)) {
      for (const field of tier.fields) {
        expect(field).not.toContain("*");
        expect(field).not.toBe("nextPageToken");
        expect(HIGHER_TIER_FIELDS).not.toContain(field);
      }
    }
  });
});
