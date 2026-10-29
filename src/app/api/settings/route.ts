import { NextResponse } from "next/server";
import { createSettingsStore } from "@/lib/server/settings";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body must be JSON." }, { status: 400 });
  }
  const paused = (body as { searchesPaused?: unknown } | null)?.searchesPaused;
  if (typeof paused !== "boolean") {
    return NextResponse.json({ ok: false, message: "searchesPaused must be a boolean." }, { status: 400 });
  }

  try {
    await createSettingsStore(getSupabaseAdmin()).setSearchPaused(paused);
  } catch {
    return NextResponse.json({ ok: false, message: "Settings could not be saved." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, searchesPaused: paused });
}
