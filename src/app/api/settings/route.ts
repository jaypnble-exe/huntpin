import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/db";
import { createSettingsStore } from "@/lib/server/settings";

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
    createSettingsStore(getDatabase()).setSearchPaused(paused, new Date());
  } catch {
    return NextResponse.json({ ok: false, message: "Settings could not be saved." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, searchesPaused: paused });
}
