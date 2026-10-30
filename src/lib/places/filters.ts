// Map filters, shared by the browser (builds the query string) and the server
// (validates it). The server never trusts the browser's values.
import { validateBBox, type BBox } from "./areas";
import { isCategoryGroup, type CategoryGroup } from "./categories";
import { WEB_PRESENCE, type WebPresence } from "./webPresence";

export const MAX_NAME_QUERY_LENGTH = 60;

export interface PlaceFilters {
  presence: WebPresence[];
  minConfidence: number;
  category: CategoryGroup | null;
  instagramOnly: boolean;
  nameQuery: string;
  saved: SavedFilter;
  /** Hide places whose name appears at 3+ locations (chains). */
  hideChains: boolean;
  source: SourceFilter;
}

export const SOURCE_FILTERS = ["all", "overture", "foursquare"] as const;
export type SourceFilter = (typeof SOURCE_FILTERS)[number];

export const SAVED_FILTERS = ["all", "hide", "only"] as const;
export type SavedFilter = (typeof SAVED_FILTERS)[number];

export const DEFAULT_FILTERS: PlaceFilters = {
  presence: ["social_only", "no_website_listed", "unknown"],
  minConfidence: 0.5,
  category: null,
  instagramOnly: false,
  nameQuery: "",
  saved: "all",
  hideChains: true,
  source: "all",
};

export const CONFIDENCE_OPTIONS = [0, 0.5, 0.7, 0.9] as const;

export function toSearchParams(bbox: BBox, filters: PlaceFilters): URLSearchParams {
  const params = new URLSearchParams({
    bbox: bbox.map((n) => n.toFixed(5)).join(","),
    presence: filters.presence.join(","),
    minConfidence: String(filters.minConfidence),
  });
  if (filters.category) params.set("category", filters.category);
  if (filters.instagramOnly) params.set("instagram", "1");
  if (filters.saved !== "all") params.set("saved", filters.saved);
  if (!filters.hideChains) params.set("chains", "show");
  if (filters.source !== "all") params.set("source", filters.source);
  const name = filters.nameQuery.trim();
  if (name) params.set("q", name);
  return params;
}

export type ParsedPlaceQuery =
  | { ok: true; bbox: BBox; filters: PlaceFilters }
  | { ok: false; error: string };

export function parsePlaceQuery(params: URLSearchParams): ParsedPlaceQuery {
  const bbox = (params.get("bbox") ?? "").split(",").map(Number);
  const bboxError = validateBBox(bbox);
  if (bboxError) return { ok: false, error: bboxError };

  const presenceRaw = params.get("presence");
  const presence = presenceRaw === null ? DEFAULT_FILTERS.presence : presenceRaw.split(",").filter(Boolean);
  if (presence.length === 0 || !presence.every((p) => (WEB_PRESENCE as readonly string[]).includes(p))) {
    return { ok: false, error: "presence must list one or more valid labels" };
  }

  const minConfidence = Number(params.get("minConfidence") ?? 0);
  if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
    return { ok: false, error: "minConfidence must be between 0 and 1" };
  }

  const categoryRaw = params.get("category");
  if (categoryRaw !== null && !isCategoryGroup(categoryRaw)) {
    return { ok: false, error: "unknown category" };
  }

  const saved = params.get("saved") ?? "all";
  if (!(SAVED_FILTERS as readonly string[]).includes(saved)) {
    return { ok: false, error: "saved must be all, hide or only" };
  }

  const source = params.get("source") ?? "all";
  if (!(SOURCE_FILTERS as readonly string[]).includes(source)) {
    return { ok: false, error: "source must be all, overture or foursquare" };
  }

  const nameQuery = (params.get("q") ?? "").trim();
  if (nameQuery.length > MAX_NAME_QUERY_LENGTH || /[\u0000-\u001f\u007f]/.test(nameQuery)) {
    return { ok: false, error: `q must be at most ${MAX_NAME_QUERY_LENGTH} printable characters` };
  }

  return {
    ok: true,
    bbox: bbox as BBox,
    filters: {
      presence: [...new Set(presence)] as WebPresence[],
      minConfidence,
      category: categoryRaw,
      instagramOnly: params.get("instagram") === "1",
      nameQuery,
      saved: saved as SavedFilter,
      hideChains: params.get("chains") !== "show",
      source: source as SourceFilter,
    },
  };
}
