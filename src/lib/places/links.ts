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
