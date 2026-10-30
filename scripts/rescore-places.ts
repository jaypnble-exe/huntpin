// Recomputes chain sizes and lead scores for an area without re-importing,
// e.g. after a migration or after changing LEAD_TARGET_CATEGORIES.
//
//   npm run rescore:places -- --area jeddah
import { parseArgs } from "node:util";
import { AREAS } from "../src/lib/places/areas";
import { parseTargetGroups } from "../src/lib/places/leadScore";
import { rescoreArea } from "../src/lib/server/rescore";
import { createSupabaseAdmin } from "../src/lib/server/supabase";

async function main() {
  const { values } = parseArgs({ options: { area: { type: "string" } }, strict: true });
  const keys = values.area ? [values.area.toLowerCase()] : Object.keys(AREAS);
  const targets = parseTargetGroups(process.env.LEAD_TARGET_CATEGORIES);
  const supabase = createSupabaseAdmin();
  for (const key of keys) {
    const area = AREAS[key];
    if (!area) throw new Error(`Unknown area "${key}". Known: ${Object.keys(AREAS).join(", ")}`);
    const result = await rescoreArea(supabase, area.name, targets);
    console.log(`${area.name}: rescored ${result.rows} places (${result.changed} changed). Targets: ${targets.join(", ")}.`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
