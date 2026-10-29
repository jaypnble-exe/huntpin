const MAPS_SEARCH_URL = "https://www.google.com/maps/search/";

/**
 * Link that opens a place in Google Maps. Maps URLs need no API key and make
 * no Places API request from this app.
 * https://developers.google.com/maps/documentation/urls/get-started
 *
 * `query` is required by Maps URLs but only used if the place ID isn't found.
 */
export function googleMapsPlaceUrl(placeId: string, query: string): string {
  const params = new URLSearchParams({ api: "1", query, query_place_id: placeId });
  return `${MAPS_SEARCH_URL}?${params}`;
}
