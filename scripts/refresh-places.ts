// Monthly data refresh: for each area, re-imports the newest Overture release
// and Foursquare (if a token is set), removing places that disappeared
// (saved leads are always kept), then rescoring.
//
//   npm run refresh:places                 all areas in src/lib/places/areas.ts
//   npm run refresh:places -- --area jeddah
//   npm run refresh:places -- --dry-run
//
// Free; makes no Google requests. scripts/register-refresh-task.ps1 can run it
// monthly via Windows Task Scheduler.
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { AREAS } from "../src/lib/places/areas";
import { latestOvertureRelease } from "../src/lib/server/placesImport";

const NODE_ARGS = ["--env-file=.env.local", "--conditions=react-server", "--import", "tsx"];

function runScript(script: string, args: string[]): boolean {
  const result = spawnSync(process.execPath, [...NODE_ARGS, script, ...args], { stdio: "inherit" });
  return result.status === 0;
}

async function main() {
  const { values } = parseArgs({
    options: {
      area: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });
  const areaKeys = values.area ? [values.area.toLowerCase()] : Object.keys(AREAS);
  for (const key of areaKeys) {
    if (!AREAS[key]) {
      console.error(`Unknown area "${key}". Known: ${Object.keys(AREAS).join(", ")}`);
      process.exit(1);
    }
  }

  console.log(`[${new Date().toISOString()}] Places refresh starting`);
  const release = await latestOvertureRelease();
  console.log(`Newest Overture release: ${release}`);
  const writeArgs = values["dry-run"] ? ["--dry-run"] : ["--prune"];
  const hasFoursquare = Boolean(process.env.FOURSQUARE_PLACES_TOKEN?.trim());
  if (!hasFoursquare) console.log("FOURSQUARE_PLACES_TOKEN not set: skipping Foursquare.");

  const failures: string[] = [];
  for (const key of areaKeys) {
    console.log(`\n== ${AREAS[key].name}: Overture ${release}`);
    if (!runScript("scripts/import-overture.ts", ["--area", key, "--release", release, ...writeArgs])) {
      failures.push(`${key}: Overture`);
      continue; // Foursquare dedupes against Overture, so skip it if Overture failed.
    }
    if (hasFoursquare) {
      console.log(`\n== ${AREAS[key].name}: Foursquare`);
      if (!runScript("scripts/import-foursquare.ts", ["--area", key, "--overture-release", release, ...writeArgs])) {
        failures.push(`${key}: Foursquare`);
      }
    }
  }

  console.log(`\n[${new Date().toISOString()}] Places refresh ${failures.length ? `finished with failures: ${failures.join(", ")}` : "complete"}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
