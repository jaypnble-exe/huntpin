import "server-only";

export const NICHE_LENGTH = { min: 2, max: 60 };
export const LOCATION_LENGTH = { min: 2, max: 80 };

const ALLOWED_KEYS = new Set(["niche", "location", "maxResults", "confirmed"]);
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export interface SearchInput {
  niche: string;
  location: string;
  maxResults: number;
  confirmed: boolean;
}

export type SearchInputResult =
  | { ok: true; input: SearchInput }
  | { ok: false; errors: string[] };

function readText(
  value: unknown,
  name: string,
  { min, max }: { min: number; max: number },
  errors: string[],
): string {
  if (typeof value !== "string") {
    errors.push(`${name} must be a string`);
    return "";
  }
  if (CONTROL_CHARS.test(value)) {
    errors.push(`${name} contains invalid characters`);
    return "";
  }
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) {
    errors.push(`${name} must be between ${min} and ${max} characters`);
  }
  return text;
}

export function validateSearchInput(
  body: unknown,
  maxResultsPerSearch: number,
): SearchInputResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: ["Request body must be a JSON object"] };
  }
  const record = body as Record<string, unknown>;
  const errors: string[] = [];

  const unknownKeys = Object.keys(record).filter((key) => !ALLOWED_KEYS.has(key));
  if (unknownKeys.length > 0) errors.push("Request contains unsupported fields");

  const niche = readText(record.niche, "niche", NICHE_LENGTH, errors);
  const location = readText(record.location, "location", LOCATION_LENGTH, errors);

  // Rejected rather than clamped, so the caller knows the limit was enforced.
  const maxResults = record.maxResults;
  if (
    typeof maxResults !== "number" ||
    !Number.isInteger(maxResults) ||
    maxResults < 1 ||
    maxResults > maxResultsPerSearch
  ) {
    errors.push(`maxResults must be an integer between 1 and ${maxResultsPerSearch}`);
  }

  if (record.confirmed !== undefined && typeof record.confirmed !== "boolean") {
    errors.push("confirmed must be a boolean");
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: {
      niche,
      location,
      maxResults: maxResults as number,
      confirmed: record.confirmed === true,
    },
  };
}
