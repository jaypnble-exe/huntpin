import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryGroup } from "../places/categories";
import { computeChainSizes, scorePlace } from "../places/leadScore";
import { classifyWebPresence, hasInstagram, type WebPresence } from "../places/webPresence";

const PAGE_SIZE = 1000;
const UPDATE_BATCH_SIZE = 1000;

interface ScoreRow {
  id: string;
  name: string | null;
  web_presence: WebPresence;
  has_instagram: boolean;
  phones: string[];
  emails: string[];
  basic_category: string | null;
  confidence: number | null;
  refreshed_on: string | null;
}

/**
 * Recomputes chain sizes and lead scores for every place in an area, across
 * all sources, so a chain split between Overture and Foursquare is still
 * caught. Only rows whose values change are written.
 */
export async function rescoreArea(
  supabase: SupabaseClient,
  area: string,
  targets?: CategoryGroup[],
  today = new Date().toISOString().slice(0, 10),
): Promise<{ rows: number; changed: number }> {
  const rows: ScoreRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("places")
      .select("id,name,web_presence,has_instagram,phones,emails,basic_category,confidence,refreshed_on")
      .eq("area", area)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`rescore read failed: ${error.message}`);
    rows.push(...(data as ScoreRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  const chainSizes = computeChainSizes(rows.map((r) => r.name));
  const updates = rows.map((row, i) => ({
    id: row.id,
    chain_size: chainSizes[i],
    lead_score: scorePlace(
      {
        webPresence: row.web_presence,
        hasInstagram: row.has_instagram,
        phoneCount: row.phones.length,
        emailCount: row.emails?.length ?? 0,
        category: row.basic_category,
        confidence: row.confidence,
        chainSize: chainSizes[i],
        refreshedOn: row.refreshed_on,
        today,
      },
      targets,
    ),
  }));

  let changed = 0;
  for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
    const { data, error } = await supabase.rpc("apply_place_scores", { p_rows: updates.slice(i, i + UPDATE_BATCH_SIZE) });
    if (error) throw new Error(`rescore write failed: ${error.message}`);
    changed += Number(data) || 0;
  }
  return { rows: rows.length, changed };
}

export interface EnrichableRow {
  id: string;
  websites: string[];
  socials: string[];
  operating_status: string | null;
  web_presence: WebPresence;
  has_instagram: boolean;
  source_datasets: string[];
  source_licenses: string[];
  [column: string]: unknown;
}

/**
 * Adds a Foursquare Instagram link to an existing place, recomputing its web
 * presence and recording Foursquare as a source. Returns null if unchanged.
 */
export function addInstagram<T extends EnrichableRow>(row: T, instagramUrl: string): T | null {
  if (row.has_instagram) return null;
  const socials = [...row.socials, instagramUrl];
  return {
    ...row,
    socials,
    has_instagram: hasInstagram({ websites: row.websites, socials }),
    web_presence: classifyWebPresence({ websites: row.websites, socials, operatingStatus: row.operating_status }),
    source_datasets: [...new Set([...row.source_datasets, "Foursquare"])],
    source_licenses: [...new Set([...row.source_licenses, "Apache-2.0"])],
  };
}

/** Applies addInstagram to existing places by id. Returns how many changed. */
export async function enrichWithInstagram(
  supabase: SupabaseClient,
  links: { placeId: string; instagramUrl: string }[],
): Promise<number> {
  let changed = 0;
  for (let i = 0; i < links.length; i += 200) {
    const batch = links.slice(i, i + 200);
    const { data, error } = await supabase.from("places").select("*").in("id", batch.map((l) => l.placeId));
    if (error) throw new Error(`enrich read failed: ${error.message}`);
    const byId = new Map(batch.map((l) => [l.placeId, l.instagramUrl]));
    const updated = (data as EnrichableRow[])
      .map((row) => addInstagram(row, byId.get(row.id)!))
      .filter((row): row is EnrichableRow => row !== null);
    if (updated.length === 0) continue;
    const { error: upsertError } = await supabase.from("places").upsert(updated, { onConflict: "id" });
    if (upsertError) throw new Error(`enrich write failed: ${upsertError.message}`);
    changed += updated.length;
  }
  return changed;
}

/** Prune only if the new import has at least this share of the existing rows. */
export const MIN_PRUNE_RATIO = 0.5;

/**
 * Removes places of one source/area missing from the latest release (keeps
 * saved leads). Skipped when the new import is suspiciously small, so an
 * outage or partial download can never empty the map.
 */
export async function prunePlaces(
  supabase: SupabaseClient,
  area: string,
  source: string,
  keepRelease: string,
  importedCount: number,
): Promise<{ removed: number; skipped: string | null }> {
  const { count, error: countError } = await supabase
    .from("places")
    .select("id", { count: "exact", head: true })
    .eq("area", area)
    .eq("source", source);
  if (countError || count === null) throw new Error(`prune count failed: ${countError?.message}`);
  if (importedCount < count * MIN_PRUNE_RATIO) {
    return { removed: 0, skipped: `only ${importedCount} imported vs ${count} existing; not pruning` };
  }
  const { data, error } = await supabase.rpc("prune_places", { p_area: area, p_source: source, p_keep_release: keepRelease });
  if (error) throw new Error(`prune failed: ${error.message}`);
  return { removed: Number(data) || 0, skipped: null };
}
