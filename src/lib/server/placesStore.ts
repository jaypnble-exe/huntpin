import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BBox } from "../places/areas";
import { CATEGORY_GROUPS } from "../places/categories";
import type { PlaceFilters } from "../places/filters";
import type { WebPresence } from "../places/webPresence";

// PostgREST returns at most 1,000 rows per request by default.
const PAGE_SIZE = 1000;
export const MAX_MAP_FEATURES = 5000;

export interface PlaceFeature {
  type: "Feature";
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    name: string | null;
    presence: WebPresence;
    instagram: boolean;
    category: string | null;
  };
}

export interface PlaceFeatureCollection {
  type: "FeatureCollection";
  features: PlaceFeature[];
  /** True when more places matched than MAX_MAP_FEATURES. */
  truncated: boolean;
}

export interface PlaceDetails {
  id: string;
  name: string | null;
  basic_category: string | null;
  websites: string[];
  socials: string[];
  phones: string[];
  web_presence: WebPresence;
  has_instagram: boolean;
  confidence: number | null;
  operating_status: string | null;
  lat: number;
  lon: number;
  source_release: string;
  source_datasets: string[];
  source_licenses: string[];
}

interface MapRow {
  id: string;
  name: string | null;
  basic_category: string | null;
  web_presence: WebPresence;
  has_instagram: boolean;
  lat: number;
  lon: number;
}

/** Escapes LIKE wildcards (and PostgREST's `*` alias) in user text. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_*]/g, (c) => `\\${c}`);
}

function buildMapQuery(supabase: SupabaseClient, [west, south, east, north]: BBox, filters: PlaceFilters) {
  let query = supabase
    .from("places")
    .select("id,name,basic_category,web_presence,has_instagram,lat,lon")
    .gte("lon", west)
    .lte("lon", east)
    .gte("lat", south)
    .lte("lat", north)
    .in("web_presence", filters.presence);
  if (filters.minConfidence > 0) query = query.gte("confidence", filters.minConfidence);
  if (filters.instagramOnly) query = query.eq("has_instagram", true);
  if (filters.category) query = query.in("basic_category", [...CATEGORY_GROUPS[filters.category].categories]);
  if (filters.nameQuery) query = query.ilike("name", `%${escapeLike(filters.nameQuery)}%`);
  // Most reliable places first, so truncation drops the least reliable.
  return query.order("confidence", { ascending: false, nullsFirst: false }).order("id");
}

/** Places in a bounding box, as GeoJSON for the map. Throws on database errors. */
export async function queryPlaces(
  supabase: SupabaseClient,
  bbox: BBox,
  filters: PlaceFilters,
): Promise<PlaceFeatureCollection> {
  const rows: MapRow[] = [];
  let truncated = false;
  for (let from = 0; from < MAX_MAP_FEATURES + 1; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, MAX_MAP_FEATURES + 1) - 1;
    const { data, error } = await buildMapQuery(supabase, bbox, filters).range(from, to);
    if (error) throw new Error("places_query_failed");
    rows.push(...(data as MapRow[]));
    if (data.length < to - from + 1) break;
  }
  if (rows.length > MAX_MAP_FEATURES) {
    truncated = true;
    rows.length = MAX_MAP_FEATURES;
  }

  return {
    type: "FeatureCollection",
    truncated,
    features: rows.map((row) => ({
      type: "Feature",
      id: row.id,
      geometry: { type: "Point", coordinates: [row.lon, row.lat] },
      properties: {
        id: row.id,
        name: row.name,
        presence: row.web_presence,
        instagram: row.has_instagram,
        category: row.basic_category,
      },
    })),
  };
}

const PLACE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

export function isValidPlaceId(id: string): boolean {
  return PLACE_ID_PATTERN.test(id);
}

/** One place's details, or null if it doesn't exist. Throws on database errors. */
export async function getPlaceDetails(supabase: SupabaseClient, id: string): Promise<PlaceDetails | null> {
  const { data, error } = await supabase
    .from("places")
    .select(
      "id,name,basic_category,websites,socials,phones,web_presence,has_instagram,confidence,operating_status,lat,lon,source_release,source_datasets,source_licenses",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("place_details_failed");
  return data as PlaceDetails | null;
}
