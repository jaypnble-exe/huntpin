// Shared by the server validator and the browser form. No secrets here.
export const NICHE_LENGTH = { min: 2, max: 60 };
export const LOCATION_LENGTH = { min: 2, max: 80 };

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildTextQuery(niche: string, location: string): string {
  return `${normalizeText(niche)} in ${normalizeText(location)}`;
}
