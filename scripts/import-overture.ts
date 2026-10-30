// Imports Overture Maps places for one area into Supabase.
//
//   npm run import:places -- --area jeddah --dry-run
//   npm run import:places -- --area jeddah
//   npm run import:places -- --bbox 46.55,24.55,46.85,24.85 --name Riyadh
//
// Reads only the matching parts of Overture's public dataset (no account, no
// cost). Makes no Google requests.
import { parseArgs } from "node:util";
import { DuckDBInstance } from "@duckdb/node-api";
import { AREAS, validateBBox, type BBox } from "../src/lib/places/areas";
import {
  DEFAULT_OVERTURE_RELEASE,
  isValidRelease,
  MAX_IMPORT_ROWS,
  overturePlacesQuery,
  summarize,
  applyChainsAndScores,
  toPlaceRow,
  upsertPlaces,
  type OverturePlace,
  type PlaceRow,
} from "../src/lib/server/placesImport";
import { createSupabaseAdmin } from "../src/lib/server/supabase";
import { parseTargetGroups } from "../src/lib/places/leadScore";

const USAGE = `Usage:
  npm run import:places -- --area <${Object.keys(AREAS).join("|")}> [--release ${DEFAULT_OVERTURE_RELEASE}] [--dry-run]
  npm run import:places -- --bbox west,south,east,north --name "City" [--release ...] [--dry-run]`;

function fail(message: string): never {
  console.error(`Error: ${message}\n\n${USAGE}`);
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

async function readOverture(release: string, bbox: BBox): Promise<OverturePlace[]> {
  const instance = await DuckDBInstance.create(":memory:");
  const connection = await instance.connect();
  try {
    await connection.run("INSTALL httpfs; LOAD httpfs; SET s3_region = 'us-west-2';");
    const reader = await connection.runAndReadAll(overturePlacesQuery(release, bbox));
    return reader.getRowObjectsJson() as unknown as OverturePlace[];
  } finally {
    connection.closeSync();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      area: { type: "string" },
      bbox: { type: "string" },
      name: { type: "string" },
      release: { type: "string", default: DEFAULT_OVERTURE_RELEASE },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });

  const area = resolveArea(values);
  const release = values.release ?? DEFAULT_OVERTURE_RELEASE;
  if (!isValidRelease(release)) fail("--release must look like 2026-10-21.0");

  console.log(`Reading Overture ${release} places for ${area.name} [${area.bbox.join(", ")}]...`);
  const raw = await readOverture(release, area.bbox);
  if (raw.length > MAX_IMPORT_ROWS) fail(`${raw.length} records exceeds the ${MAX_IMPORT_ROWS} limit; use a smaller bbox`);

  let targets;
  try {
    targets = parseTargetGroups(process.env.LEAD_TARGET_CATEGORIES);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  const rows = applyChainsAndScores(
    raw.map((record) => toPlaceRow(record, { release, area: area.name })).filter((row): row is PlaceRow => row !== null),
    targets,
  );
  console.log(`Read ${raw.length} records, ${rows.length} usable. Target categories: ${targets.join(", ")}.`);
  console.log(JSON.stringify(summarize(rows), null, 2));

  if (values["dry-run"]) {
    console.log("Dry run: nothing was written.");
    return;
  }

  const supabase = createSupabaseAdmin();
  const { data: run, error } = await supabase
    .from("place_imports")
    .insert({ source: "overture", source_release: release, area: area.name, bbox: area.bbox, status: "running" })
    .select("id")
    .single();
  if (error || !run) throw new Error(`could not record the import (has 002_places.sql been run?): ${error?.message}`);

  try {
    await upsertPlaces(supabase, rows, (done) => process.stdout.write(`\rUpserted ${done}/${rows.length}`));
    process.stdout.write("\n");
    await supabase
      .from("place_imports")
      .update({ status: "success", row_count: rows.length, completed_at: new Date().toISOString() })
      .eq("id", run.id);
    console.log("Import complete.");
  } catch (importError) {
    await supabase
      .from("place_imports")
      .update({ status: "failure", error_category: "upsert_failed", completed_at: new Date().toISOString() })
      .eq("id", run.id);
    throw importError;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
