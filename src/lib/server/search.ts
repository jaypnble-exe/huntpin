import "server-only";
import { buildTextQuery } from "../searchLimits";
import type { ConfigResult } from "./config";
import { FIELD_TIERS, type FieldTier } from "./places/fieldMasks";
import { textSearch, type PlaceResult } from "./places/textSearch";
import type { RateLimiter } from "./rateLimit";
import { validateSearchInput } from "./searchInput";
import type { SettingsStore } from "./settings";
import type { UsageStore } from "./usage";

export type SearchErrorCode =
  | "config_invalid"
  | "search_disabled"
  | "invalid_input"
  | "confirmation_required"
  | "searches_paused"
  | "rate_limited"
  | "usage_tracking_unavailable"
  | "monthly_limit_reached"
  | "places_request_failed";

export type SearchResponseBody =
  | {
      ok: true;
      places: PlaceResult[];
      fieldTier: FieldTier;
      sku: string;
      usage: { used: number; limit: number };
    }
  | { ok: false; error: SearchErrorCode; message: string; details?: string[] };

export interface SearchOutcome {
  status: number;
  body: SearchResponseBody;
}

export interface SearchDeps {
  config: ConfigResult;
  usage: UsageStore;
  settings: SettingsStore;
  rateLimiter: RateLimiter;
  fetchFn?: typeof fetch;
  now?: () => Date;
}

function fail(
  status: number,
  error: SearchErrorCode,
  message: string,
  details?: string[],
): SearchOutcome {
  return { status, body: { ok: false, error, message, ...(details && { details }) } };
}

/**
 * Runs one user-confirmed Text Search. Every safety check happens before the
 * request, and each one fails closed. At most one Google request per call.
 */
export async function runSearch(body: unknown, deps: SearchDeps): Promise<SearchOutcome> {
  const now = deps.now ?? (() => new Date());

  if (!deps.config.ok) {
    return fail(503, "config_invalid", "Server safety configuration is missing or invalid.", deps.config.errors);
  }
  const config = deps.config.config;

  if (!config.placesSearchEnabled || !config.googleMapsApiKey) {
    return fail(403, "search_disabled", "Places search is disabled (PLACES_SEARCH_ENABLED is not true).");
  }

  const parsed = validateSearchInput(body, config.maxResultsPerSearch);
  if (!parsed.ok) return fail(400, "invalid_input", "Invalid search request.", parsed.errors);
  const input = parsed.input;

  if (!input.confirmed) {
    return fail(400, "confirmation_required", "Confirm the search before a Google request is made.");
  }

  try {
    if (await deps.settings.isSearchPaused()) {
      return fail(423, "searches_paused", "Searches are paused in app settings.");
    }
  } catch {
    return fail(503, "usage_tracking_unavailable", "App settings could not be read, so the search was refused.");
  }

  if (!deps.rateLimiter.tryAcquire(now().getTime())) {
    return fail(429, "rate_limited", "Too many searches. Wait a minute and try again.");
  }

  const sku = FIELD_TIERS[config.fieldTier].sku;
  let reservation;
  try {
    reservation = await deps.usage.reserve({
      limit: config.maxPlacesRequestsPerMonth,
      sku,
      eventType: "places_text_search",
    });
  } catch {
    return fail(503, "usage_tracking_unavailable", "Usage tracking is unavailable, so the search was refused.");
  }
  if (!reservation.ok) {
    return fail(429, "monthly_limit_reached", "The app's monthly Places request limit has been reached.");
  }

  const result = await textSearch({
    apiKey: config.googleMapsApiKey,
    textQuery: buildTextQuery(input.niche, input.location),
    pageSize: input.maxResults,
    fieldTier: config.fieldTier,
    fetchFn: deps.fetchFn,
  });

  try {
    await deps.usage.complete(reservation.eventId, {
      success: result.ok,
      errorCategory: result.ok ? null : result.errorCategory,
    });
  } catch {
    // The reservation already counts toward the limit; only the outcome is lost.
    console.warn("usage_event_completion_failed");
  }

  if (!result.ok) {
    return fail(502, "places_request_failed", `Google Places request failed (${result.errorCategory}).`);
  }

  let used = config.maxPlacesRequestsPerMonth;
  try {
    used = await deps.usage.countThisMonth();
  } catch {
    // Report the limit as fully used if the count can't be read.
  }

  return {
    status: 200,
    body: {
      ok: true,
      places: result.places,
      fieldTier: config.fieldTier,
      sku,
      usage: { used, limit: config.maxPlacesRequestsPerMonth },
    },
  };
}
