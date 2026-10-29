import "server-only";

/**
 * Field masks for Text Search (New). The SKU is decided by the most expensive
 * field requested, so these lists are the main cost control. Never use "*".
 *
 * Verified 2026-10-29 against:
 *   https://developers.google.com/maps/documentation/places/web-service/text-search
 *   https://developers.google.com/maps/billing-and-pricing/pricing
 * Re-check both pages (and your billing report) before relying on these values.
 *
 * Fields that would move a request to a higher tier and must NOT be added
 * without explicit approval: places.websiteUri, places.nationalPhoneNumber,
 * places.internationalPhoneNumber, places.rating, places.regularOpeningHours,
 * places.reviews, places.photos (Enterprise / Enterprise + Atmosphere).
 */
export const FIELD_TIERS = {
  // Default. Listed by Google with an unlimited free monthly cap.
  ids_only: {
    fields: ["places.id"],
    sku: "Text Search Essentials (IDs Only)",
    freeMonthlyCap: "unlimited",
  },
  // Opt-in. Listed with a 5,000 requests/month free cap, billed above that.
  pro: {
    fields: ["places.id", "places.displayName", "places.formattedAddress"],
    sku: "Text Search Pro",
    freeMonthlyCap: "5,000 requests/month",
  },
} as const;

export type FieldTier = keyof typeof FIELD_TIERS;

export function isFieldTier(value: string): value is FieldTier {
  return Object.hasOwn(FIELD_TIERS, value);
}

export function fieldMaskFor(tier: FieldTier): string {
  return FIELD_TIERS[tier].fields.join(",");
}
