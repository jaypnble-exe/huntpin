import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/server/config";
import { createRateLimiter } from "@/lib/server/rateLimit";
import { runSearch } from "@/lib/server/search";
import { createSettingsStore } from "@/lib/server/settings";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { createUsageStore } from "@/lib/server/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2048;
const rateLimiter = createRateLimiter({ limit: 3, windowMs: 60_000 });

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "invalid_input", message: "Request too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_input", message: "Body must be JSON." }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { ok: false, error: "usage_tracking_unavailable", message: "Usage tracking is unavailable, so the search was refused." },
      { status: 503 },
    );
  }

  const outcome = await runSearch(body, {
    config: loadConfig(),
    usage: createUsageStore(supabase),
    settings: createSettingsStore(supabase),
    rateLimiter,
  });
  return NextResponse.json(outcome.body, { status: outcome.status });
}
