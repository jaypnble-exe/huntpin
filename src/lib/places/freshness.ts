// How current a place's listing looks in the open data. These are the
// sources' own estimates, not proof that a business is open or closed.

/** Listings not updated for this many months count as stale. */
export const STALE_AFTER_MONTHS = 12;
/** Overture existence scores below this count as doubtful. */
export const LOW_CONFIDENCE = 0.6;

export interface FreshnessInput {
  confidence: number | null;
  operating_status: string | null;
  /** Foursquare's last update, YYYY-MM-DD. */
  refreshed_on: string | null;
}

export interface Freshness {
  label: string;
  /** True when the data suggests the business may be inactive. */
  stale: boolean;
}

function monthsSince(date: string, today: Date): number {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return (today.getUTCFullYear() - d.getUTCFullYear()) * 12 + (today.getUTCMonth() - d.getUTCMonth());
}

/** The cut-off date for the "updated in the last year" filter, YYYY-MM-DD. */
export function staleBefore(today = new Date()): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - STALE_AFTER_MONTHS, today.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

/** A short line about how current the listing is, or null when the data says nothing. */
export function listingFreshness(place: FreshnessInput, today = new Date()): Freshness | null {
  if (place.operating_status && place.operating_status !== "open") {
    return { label: `Data says ${place.operating_status.replace(/_/g, " ")}`, stale: true };
  }
  if (place.refreshed_on) {
    const when = new Date(`${place.refreshed_on.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    return { label: `Listing updated ${when}`, stale: monthsSince(place.refreshed_on, today) > STALE_AFTER_MONTHS };
  }
  if (place.confidence !== null) {
    return {
      label: `Still exists: ${Math.round(place.confidence * 100)}%`,
      stale: place.confidence < LOW_CONFIDENCE,
    };
  }
  return null;
}
