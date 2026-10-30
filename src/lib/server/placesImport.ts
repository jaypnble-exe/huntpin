import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BBox } from "../places/areas";
import { computeChainSizes, scorePlace } from "../places/leadScore";
import type { CategoryGroup } from "../places/categories";
import { classifyWebPresence, hasInstagram, type WebPresence } from "../places/webPresence";

// Overture Maps release to import. Check https://docs.overturemaps.org/release/
// for newer releases; pass --release to the import script to override.
export const DEFAULT_OVERTURE_RELEASE = "2026-10-21.0";
const RELEASE_PATTERN = /^\d{4}-\d{2}-\d{2}\.\d+$/;

// Refuse unexpectedly large imports (Supabase Free plan has 500 MB).
export const MAX_IMPORT_ROWS = 100_000;
const UPSERT_BATCH_SIZE = 500;

export function isValidRelease(release: string): boolean {
  return RELEASE_PATTERN.test(release);
}

const RELEASE_LISTING_URL = "https://overturemaps-us-west-2.s3.amazonaws.com/?list-type=2&prefix=release/&delimiter=/";

function compareReleases(a: string, b: string): number {
  const [dateA, revA] = a.split(".");
  const [dateB, revB] = b.split(".");
  return dateA === dateB ? Number(revA) - Number(revB) : dateA < dateB ? -1 : 1;
}

/** Newest Overture release, from the public bucket listing (no account needed). */
export async function latestOvertureRelease(fetchFn: typeof fetch = fetch): Promise<string> {
  const response = await fetchFn(RELEASE_LISTING_URL, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Overture release listing failed (HTTP ${response.status})`);
  const xml = await response.text();
  const releases = [...xml.matchAll(/<Prefix>release\/([^/<]+)\/<\/Prefix>/g)]
    .map((m) => m[1])
    .filter(isValidRelease)
    .sort(compareReleases);
  const latest = releases.at(-1);
  if (!latest) throw new Error("No Overture releases found in the listing");
  return latest;
}

/**
 * DuckDB query for one bounding box of the Overture places theme. Inputs are
 * validated (release pattern, finite numbers) before being interpolated.
 */
export function overturePlacesQuery(release: string, bbox: BBox): string {
  if (!isValidRelease(release)) throw new Error("invalid Overture release");
  if (bbox.some((n) => !Number.isFinite(n))) throw new Error("invalid bbox");
  const [west, south, east, north] = bbox;
  return `
    SELECT id, names.primary AS name, basic_category, taxonomy.primary AS taxonomy_primary,
           websites, socials, phones, confidence, operating_status,
           (bbox.xmin + bbox.xmax) / 2 AS lon, (bbox.ymin + bbox.ymax) / 2 AS lat,
           list_transform(sources, s -> s.dataset) AS source_datasets,
           list_transform(sources, s -> s.license) AS source_licenses
    FROM read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*', hive_partitioning = 1)
    WHERE bbox.xmin BETWEEN ${west} AND ${east} AND bbox.ymin BETWEEN ${south} AND ${north}
  `;
}

export interface OverturePlace {
  id: unknown;
  name: unknown;
  basic_category: unknown;
  taxonomy_primary: unknown;
  websites: unknown;
  socials: unknown;
  phones: unknown;
  confidence: unknown;
  operating_status: unknown;
  lon: unknown;
  lat: unknown;
  source_datasets: unknown;
  source_licenses: unknown;
}

export interface PlaceRow {
  id: string;
  source: "overture" | "foursquare";
  source_release: string;
  area: string;
  name: string | null;
  basic_category: string | null;
  taxonomy_primary: string | null;
  websites: string[];
  socials: string[];
  phones: string[];
  web_presence: WebPresence;
  has_instagram: boolean;
  confidence: number | null;
  operating_status: string | null;
  lat: number;
  lon: number;
  source_datasets: string[];
  source_licenses: string[];
  /** Foursquare last-updated date; null for Overture. */
  refreshed_on: string | null;
  /** Places in the same area sharing this name; set by rescoring. */
  chain_size: number;
  lead_score: number;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim()))];
}

/** Maps one Overture record to a database row, or null if it is unusable. */
export function toPlaceRow(
  raw: OverturePlace,
  { release, area }: { release: string; area: string },
): PlaceRow | null {
  const id = text(raw.id);
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!id || id.length > 100) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  const websites = textList(raw.websites);
  const socials = textList(raw.socials);
  const operatingStatus = text(raw.operating_status);
  const confidence = typeof raw.confidence === "number" && raw.confidence >= 0 && raw.confidence <= 1 ? raw.confidence : null;

  return {
    id,
    source: "overture",
    source_release: release,
    area,
    name: text(raw.name),
    basic_category: text(raw.basic_category),
    taxonomy_primary: text(raw.taxonomy_primary),
    websites,
    socials,
    phones: textList(raw.phones),
    web_presence: classifyWebPresence({ websites, socials, operatingStatus }),
    has_instagram: hasInstagram({ websites, socials }),
    confidence,
    operating_status: operatingStatus,
    lat,
    lon,
    source_datasets: textList(raw.source_datasets),
    source_licenses: textList(raw.source_licenses),
    refreshed_on: null,
    chain_size: 1,
    lead_score: 0,
  };
}

/** Sets chain sizes across the whole import, then scores every row. */
export function applyChainsAndScores(rows: PlaceRow[], targets?: CategoryGroup[]): PlaceRow[] {
  const chainSizes = computeChainSizes(rows.map((row) => row.name));
  return rows.map((row, i) => {
    const chain_size = chainSizes[i];
    const lead_score = scorePlace(
      {
        webPresence: row.web_presence,
        hasInstagram: row.has_instagram,
        phoneCount: row.phones.length,
        category: row.basic_category,
        confidence: row.confidence,
        chainSize: chain_size,
        refreshedOn: row.refreshed_on,
      },
      targets,
    );
    return { ...row, chain_size, lead_score };
  });
}

export function summarize(rows: PlaceRow[]) {
  const byPresence: Record<string, number> = {};
  for (const row of rows) byPresence[row.web_presence] = (byPresence[row.web_presence] ?? 0) + 1;
  return {
    total: rows.length,
    byPresence,
    withInstagram: rows.filter((r) => r.has_instagram).length,
    chains: rows.filter((r) => r.chain_size >= 3).length,
    scoreAtLeast70: rows.filter((r) => r.lead_score >= 70).length,
    licenses: [...new Set(rows.flatMap((r) => r.source_licenses))].sort(),
  };
}

/** Upserts by Overture ID in batches. Throws on the first failed batch. */
export async function upsertPlaces(
  supabase: SupabaseClient,
  rows: PlaceRow[],
  onProgress?: (done: number) => void,
): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase.from("places").upsert(
      batch.map((row) => ({ ...row, imported_at: new Date().toISOString() })),
      { onConflict: "id" },
    );
    if (error) throw new Error(`places upsert failed at row ${i}: ${error.message}`);
    onProgress?.(Math.min(i + UPSERT_BATCH_SIZE, rows.length));
  }
}
