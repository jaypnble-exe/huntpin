import "server-only";
import { isFieldTier, type FieldTier } from "./places/fieldMasks";

// Code-level ceilings. Environment values above these are rejected, so a typo
// in .env.local cannot raise the safety limits.
export const HARD_MAX_RESULTS_PER_SEARCH = 10;
export const HARD_MAX_PLACES_REQUESTS_PER_MONTH = 100;

export interface AppConfig {
  placesSearchEnabled: boolean;
  googleMapsApiKey: string | null;
  maxResultsPerSearch: number;
  maxPlacesRequestsPerMonth: number;
  fieldTier: FieldTier;
}

export type ConfigResult =
  | { ok: true; config: AppConfig }
  | { ok: false; errors: string[] };

type Env = Record<string, string | undefined>;

function parseIntInRange(
  env: Env,
  name: string,
  min: number,
  max: number,
  errors: string[],
): number {
  const raw = env[name]?.trim();
  if (!raw) {
    errors.push(`${name} is required`);
    return 0;
  }
  const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    errors.push(`${name} must be an integer between ${min} and ${max}`);
    return 0;
  }
  return value;
}

/**
 * Reads and validates server configuration. Fails closed: any missing or
 * invalid safety setting makes the whole config invalid, and callers must
 * refuse to call Google. Error messages never include configured values.
 */
export function loadConfig(env: Env = process.env): ConfigResult {
  const errors: string[] = [];

  const enabledRaw = env.PLACES_SEARCH_ENABLED?.trim().toLowerCase() ?? "";
  if (!["", "true", "false"].includes(enabledRaw)) {
    errors.push("PLACES_SEARCH_ENABLED must be 'true' or 'false'");
  }
  const placesSearchEnabled = enabledRaw === "true";

  const maxResultsPerSearch = parseIntInRange(
    env,
    "MAX_RESULTS_PER_SEARCH",
    1,
    HARD_MAX_RESULTS_PER_SEARCH,
    errors,
  );
  const maxPlacesRequestsPerMonth = parseIntInRange(
    env,
    "MAX_PLACES_REQUESTS_PER_MONTH",
    0,
    HARD_MAX_PLACES_REQUESTS_PER_MONTH,
    errors,
  );

  const tierRaw = env.PLACES_FIELD_TIER?.trim() || "ids_only";
  if (!isFieldTier(tierRaw)) {
    errors.push("PLACES_FIELD_TIER must be 'ids_only' or 'pro'");
  }
  const fieldTier: FieldTier = isFieldTier(tierRaw) ? tierRaw : "ids_only";

  const googleMapsApiKey = env.GOOGLE_MAPS_API_KEY?.trim() || null;
  if (placesSearchEnabled && !googleMapsApiKey) {
    errors.push("GOOGLE_MAPS_API_KEY is required when PLACES_SEARCH_ENABLED=true");
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    config: {
      placesSearchEnabled,
      googleMapsApiKey,
      maxResultsPerSearch,
      maxPlacesRequestsPerMonth,
      fieldTier,
    },
  };
}
