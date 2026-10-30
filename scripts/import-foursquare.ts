// Imports Foursquare OS Places for one area into Supabase, skipping places
// already on the map from Overture, and adds Foursquare Instagram handles to
// matching Overture places. Then rescores the whole area.
//
//   npm run import:foursquare -- --area jeddah --dry-run
//   npm run import:foursquare -- --area jeddah [--prune] [--since 2024-01-01]
//
// Needs FOURSQUARE_PLACES_TOKEN (Places Portal) in .env.local. Free; makes no
// Google requests. The token is never printed.
import { parseArgs } from "node:util";
import { DuckDBInstance } from "@duckdb/node-api";
import { AREAS, validateBBox, type BBox } from "../src/lib/places/areas";
import { parseTargetGroups } from "../src/lib/places/leadScore";
import {
  DEFAULT_REFRESHED_SINCE,
  FSQ_CATALOG_ENDPOINT,
  foursquareQuery,
  instagramUrl,
  MATCH_SQL,
  toFoursquarePlaceRow,
  type FoursquarePlace,
} from "../src/lib/server/foursquareImport";
import { DEFAULT_OVERTURE_RELEASE, MAX_IMPORT_ROWS, summarize, upsertPlaces, type PlaceRow } from "../src/lib/server/placesImport";
import { enrichWithInstagram, prunePlaces, rescoreArea } from "../src/lib/server/rescore";
import { createSupabaseAdmin } from "../src/lib/server/supabase";

const USAGE = `Usage:
  npm run import:foursquare -- --area <${Object.keys(AREAS).join("|")}> [--since YYYY-MM-DD] [--prune] [--dry-run]
  npm run import:foursquare -- --bbox west,south,east,north --name "City" [...]`;

const token = process.env.FOURSQUARE_PLACES_TOKEN?.trim() ?? "";
const scrub = (text: string) => (token ? text.split(token).join("<token>") : text);

function fail(message: string): never {
  console.error(`Error: ${scrub(message)}\n\n${USAGE}`);
  process.exit(1);
}

function resolveArea(values: { area?: string; bbox?: string; name?: string }): { name: string; bbox: BBox } {
  if (values.area) {
    const preset = AREAS[values.area.toLowerCase()];
    if (!preset) fail(`unknown area "${values.area}"`);
    return preset;
  }
  if (values.bbox && values.name) {
    const bbox = values.bbox.split(",").map(Number);
    const error = validateBBox(bbox);
    if (error) fail(error);
    const name = values.name.trim();
    if (name.length < 1 || name.length > 80) fail("--name must be 1 to 80 characters");
    return { name, bbox: bbox as BBox };
  }
  fail("pass --area, or --bbox together with --name");
}

async function main() {
  const { values } = parseArgs({
    options: {
      area: { type: "string" },
      bbox: { type: "string" },
      name: { type: "string" },
      since: { type: "string", default: DEFAULT_REFRESHED_SINCE },
      "overture-release": { type: "string", default: DEFAULT_OVERTURE_RELEASE },
      prune: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });
  if (!token) fail("FOURSQUARE_PLACES_TOKEN is missing from .env.local");
  if (/['"\s]/.test(token)) fail("FOURSQUARE_PLACES_TOKEN contains quotes or spaces");
  const area = resolveArea(values);
  const since = values.since ?? DEFAULT_REFRESHED_SINCE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) fail("--since must be YYYY-MM-DD");
  const overtureRelease = values["overture-release"] ?? DEFAULT_OVERTURE_RELEASE;
  if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(overtureRelease)) fail("--overture-release must look like 2026-10-21.0");
  let targets;
  try {
    targets = parseTargetGroups(process.env.LEAD_TARGET_CATEGORIES);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  const release = `fsq-${new Date().toISOString().slice(0, 10)}`;
  const [west, south, east, north] = area.bbox;

  console.log(`Reading Foursquare and Overture places for ${area.name} [${area.bbox.join(", ")}]...`);
  const instance = await DuckDBInstance.create(":memory:");
  const db = await instance.connect();
  let raw: FoursquarePlace[];
  let matches: Map<string, string>;
  try {
    await db.run("INSTALL iceberg; LOAD iceberg; INSTALL httpfs; LOAD httpfs;");
    await db.run(`CREATE SECRET fsq_secret (TYPE iceberg, TOKEN '${token}')`);
    await db.run(`ATTACH 'places' AS fsq (TYPE iceberg, SECRET fsq_secret, ENDPOINT '${FSQ_CATALOG_ENDPOINT}')`);
    await db.run(`CREATE TABLE f AS ${foursquareQuery(area.bbox)}`);
    await db.run("SET s3_region = 'us-west-2'");
    await db.run(`
      CREATE TABLE o AS
      SELECT id, names.primary AS name, (bbox.ymin + bbox.ymax) / 2 AS lat, (bbox.xmin + bbox.xmax) / 2 AS lon,
             list_transform(sources, s -> s.record_id) AS record_ids
      FROM read_parquet('s3://overturemaps-us-west-2/release/${overtureRelease}/theme=places/type=place/*', hive_partitioning = 1)
      WHERE bbox.xmin BETWEEN ${west} AND ${east} AND bbox.ymin BETWEEN ${south} AND ${north}`);
    await db.run(MATCH_SQL);
    raw = (await db.runAndReadAll("SELECT * FROM f")).getRowObjectsJson() as unknown as FoursquarePlace[];
    const matchRows = (await db.runAndReadAll("SELECT fsq_place_id, overture_id FROM matches")).getRowObjectsJson();
    matches = new Map(matchRows.map((r) => [String(r.fsq_place_id), String(r.overture_id)]));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  } finally {
    db.closeSync();
  }
  if (raw.length > MAX_IMPORT_ROWS * 2) fail(`${raw.length} records is too many; use a smaller bbox`);

  const rows = raw
    .filter((r) => !matches.has(String(r.fsq_place_id)))
    .map((r) => toFoursquarePlaceRow(r, { area: area.name, release, refreshedSince: since }))
    .filter((row): row is PlaceRow => row !== null);
  const links = raw
    .filter((r) => matches.has(String(r.fsq_place_id)) && instagramUrl(r.instagram))
    .map((r) => ({ placeId: matches.get(String(r.fsq_place_id))!, instagramUrl: instagramUrl(r.instagram)! }));

  console.log(`Foursquare records: ${raw.length}. Already on the map: ${matches.size}. New places to add: ${rows.length}.`);
  console.log(`Instagram handles for places already on the map: ${links.length}.`);
  console.log(JSON.stringify(summarize(rows), null, 2));

  if (values["dry-run"]) {
    console.log("Dry run: nothing was written.");
    return;
  }

  const supabase = createSupabaseAdmin();
  const { data: run, error } = await supabase
    .from("place_imports")
    .insert({ source: "foursquare", source_release: release, area: area.name, bbox: area.bbox, status: "running" })
    .select("id")
    .single();
  if (error || !run) fail(`could not record the import (has 007_foursquare_and_refresh.sql been run?): ${error?.message}`);

  try {
    await upsertPlaces(supabase, rows, (done) => process.stdout.write(`\rUpserted ${done}/${rows.length}`));
    process.stdout.write("\n");
    console.log(`Added Instagram to ${await enrichWithInstagram(supabase, links)} existing places.`);
    if (values.prune) {
      const pruned = await prunePlaces(supabase, area.name, "foursquare", release, rows.length);
      console.log(pruned.skipped ? `Prune skipped: ${pruned.skipped}.` : `Removed ${pruned.removed} outdated Foursquare places.`);
    }
    const rescored = await rescoreArea(supabase, area.name, targets);
    console.log(`Rescored ${rescored.rows} places in ${area.name} (${rescored.changed} changed).`);
    await supabase
      .from("place_imports")
      .update({ status: "success", row_count: rows.length, completed_at: new Date().toISOString() })
      .eq("id", run.id);
    console.log("Import complete.");
  } catch (importError) {
    await supabase
      .from("place_imports")
      .update({ status: "failure", error_category: "import_failed", completed_at: new Date().toISOString() })
      .eq("id", run.id);
    throw importError;
  }
}

main().catch((error: unknown) => {
  console.error(scrub(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
