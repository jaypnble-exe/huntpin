// Links shown for place data. Imported URLs are third-party data, so only
// http(s) links are made clickable.

export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** `tel:` link from a listed phone number, keeping only + and digits. */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{5,15}$/.test(digits) ? `tel:${digits}` : null;
}

/** Opens coordinates in Google Maps (Maps URLs: no API key, no Places request). */
export function googleMapsCoordinatesUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({ api: "1", query: `${lat},${lon}` });
  return `https://www.google.com/maps/search/?${params}`;
}

function searchText(name: string | null, area: string | null): string | null {
  const cleanName = name?.replace(/\s+/g, " ").trim();
  if (!cleanName) return null;
  return area ? `${cleanName}, ${area}` : cleanName;
}

/**
 * Searches Google Maps for the business by name and city, which usually opens
 * its own listing (rating, reviews, photos). Falls back to coordinates.
 * Maps URLs: no API key, no Places request.
 */
export function googleMapsSearchUrl(name: string | null, area: string | null, lat: number, lon: number): string {
  const query = searchText(name, area);
  if (!query) return googleMapsCoordinatesUrl(lat, lon);
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params}`;
}

/**
 * Maps Embed API "place" view for the business (Google renders the card in an
 * iframe; nothing is fetched or stored by this app). Needs a browser key
 * restricted to the Maps Embed API. Returns null without a name or key.
 */
export function googleMapsEmbedUrl(
  key: string,
  { name, area, lat, lon }: { name: string | null; area: string | null; lat: number; lon: number },
): string | null {
  const query = searchText(name, area);
  if (!key.trim() || !query) return null;
  const params = new URLSearchParams({ key: key.trim(), q: query, center: `${lat},${lon}`, zoom: "17" });
  return `https://www.google.com/maps/embed/v1/place?${params}`;
}
