import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BBox } from "../places/areas";
import { CATEGORY_GROUPS } from "../places/categories";
import { CHAIN_MIN_LOCATIONS, parseTargetGroups, scoreParts, type ScorePart } from "../places/leadScore";
import type { LeadStatus } from "../leads/leads";
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
    /** Status of the saved lead for this place, or null if not saved. */
    leadStatus: LeadStatus | null;
    /** 0-100 lead score from the import (higher is a better prospect). */
    score: number;
    chain: boolean;
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
  source: "overture" | "foursquare";
  source_release: string;
  source_datasets: string[];
  source_licenses: string[];
  lead_score: number;
  chain_size: number;
  /** Why the place has its score (computed on the server with the configured target categories). */
  score_parts: ScorePart[];
}

interface MapRow {
  id: string;
  name: string | null;
  basic_category: string | null;
  web_presence: WebPresence;
  has_instagram: boolean;
  lat: number;
  lon: number;
  lead_score: number;
  chain_size: number;
  // One-to-one (leads.overture_place_id is unique), so PostgREST returns an
  // object or null; accept an array too in case the relationship is read as many.
  lead: { lead_status: LeadStatus } | { lead_status: LeadStatus }[] | null;
}

function leadStatusOf(lead: MapRow["lead"]): LeadStatus | null {
  const first = Array.isArray(lead) ? lead[0] : lead;
  return first?.lead_status ?? null;
}

/** Escapes LIKE wildcards (and PostgREST's `*` alias) in user text. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_*]/g, (c) => `\\${c}`);
}

function buildMapQuery(supabase: SupabaseClient, [west, south, east, north]: BBox, filters: PlaceFilters) {
  let query = supabase
    .from("places")
    .select(
      `id,name,basic_category,web_presence,has_instagram,lat,lon,lead_score,chain_size,lead:leads${filters.saved === "only" ? "!inner" : ""}(lead_status)`,
    )
    .gte("lon", west)
    .lte("lon", east)
    .gte("lat", south)
    .lte("lat", north)
    .in("web_presence", filters.presence);
  // Confidence is an Overture score; Foursquare places (null) are kept and are
  // pre-filtered to recently updated ones at import instead.
  if (filters.minConfidence > 0) query = query.or(`confidence.gte.${filters.minConfidence},confidence.is.null`);
  if (filters.instagramOnly) query = query.eq("has_instagram", true);
  if (filters.category) query = query.in("basic_category", [...CATEGORY_GROUPS[filters.category].categories]);
  if (filters.nameQuery) query = query.ilike("name", `%${escapeLike(filters.nameQuery)}%`);
  if (filters.saved === "hide") query = query.is("lead", null);
  if (filters.hideChains) query = query.lt("chain_size", CHAIN_MIN_LOCATIONS);
  // Best leads first, so truncation drops the weakest prospects.
  return query
    .order("lead_score", { ascending: false })
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("id");
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
        leadStatus: leadStatusOf(row.lead),
        score: row.lead_score,
        chain: row.chain_size >= CHAIN_MIN_LOCATIONS,
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
      "id,name,basic_category,websites,socials,phones,web_presence,has_instagram,confidence,operating_status,lat,lon,source,source_release,source_datasets,source_licenses,lead_score,chain_size",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("place_details_failed");
  if (!data) return null;
  const place = data as Omit<PlaceDetails, "score_parts">;
  const score_parts = scoreParts(
    {
      webPresence: place.web_presence,
      hasInstagram: place.has_instagram,
      phoneCount: place.phones.length,
      category: place.basic_category,
      confidence: place.confidence,
      chainSize: place.chain_size,
    },
    parseTargetGroups(process.env.LEAD_TARGET_CATEGORIES),
  );
  return { ...place, score_parts };
}
