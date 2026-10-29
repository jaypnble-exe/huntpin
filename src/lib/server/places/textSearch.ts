import "server-only";
import { fieldMaskFor, type FieldTier } from "./fieldMasks";

// Text Search (New). Verified 2026-10-29:
// https://developers.google.com/maps/documentation/places/web-service/text-search
export const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DEFAULT_TIMEOUT_MS = 10_000;

export interface PlaceResult {
  placeId: string;
  displayName: string | null;
  formattedAddress: string | null;
}

export type PlacesErrorCategory =
  | "invalid_request"
  | "permission_denied"
  | "quota_exceeded"
  | "upstream_error"
  | "timeout"
  | "network_error"
  | "malformed_response";

export type TextSearchResult =
  | { ok: true; places: PlaceResult[] }
  | { ok: false; errorCategory: PlacesErrorCategory; httpStatus?: number };

function categorizeStatus(status: number): PlacesErrorCategory {
  if (status === 400) return "invalid_request";
  if (status === 401 || status === 403) return "permission_denied";
  if (status === 429) return "quota_exceeded";
  return "upstream_error";
}

function readPlaces(json: unknown, pageSize: number): PlaceResult[] | null {
  if (typeof json !== "object" || json === null) return null;
  const raw = (json as { places?: unknown }).places;
  // Google returns an empty object when nothing matches.
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;

  const seen = new Set<string>();
  const places: PlaceResult[] = [];
  for (const item of raw) {
    const id = (item as { id?: unknown } | null)?.id;
    if (typeof id !== "string" || id.length === 0) return null;
    if (seen.has(id)) continue;
    seen.add(id);
    const name = (item as { displayName?: { text?: unknown } }).displayName?.text;
    const address = (item as { formattedAddress?: unknown }).formattedAddress;
    places.push({
      placeId: id,
      displayName: typeof name === "string" ? name : null,
      formattedAddress: typeof address === "string" ? address : null,
    });
  }
  return places.slice(0, pageSize);
}

/**
 * Makes exactly one Text Search request. No pagination (nextPageToken is not
 * in the field mask), no retries, and no per-result detail requests.
 * Never logs or returns the API key.
 */
export async function textSearch({
  apiKey,
  textQuery,
  pageSize,
  fieldTier,
  fetchFn = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  apiKey: string;
  textQuery: string;
  pageSize: number;
  fieldTier: FieldTier;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): Promise<TextSearchResult> {
  let response: Response;
  try {
    response = await fetchFn(TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMaskFor(fieldTier),
      },
      body: JSON.stringify({ textQuery, pageSize }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
      redirect: "error",
    });
  } catch (error) {
    const name = (error as { name?: unknown } | null)?.name;
    return {
      ok: false,
      errorCategory: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network_error",
    };
  }

  if (!response.ok) {
    return { ok: false, errorCategory: categorizeStatus(response.status), httpStatus: response.status };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, errorCategory: "malformed_response" };
  }
  const places = readPlaces(json, pageSize);
  if (!places) return { ok: false, errorCategory: "malformed_response" };
  return { ok: true, places };
}
