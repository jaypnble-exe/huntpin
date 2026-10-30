import { NextResponse } from "next/server";
import { mergeTemplates, parseTemplates } from "@/lib/leads/outreach";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { getTemplates, resetTemplates, saveTemplates } from "@/lib/server/templatesStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = "Templates are unavailable. Check Supabase.";
const MAX_BODY_BYTES = 100_000;

// GET /api/templates      the message templates (edited, or the defaults)
export async function GET() {
  try {
    return NextResponse.json(await getTemplates(getSupabaseAdmin()));
  } catch {
    return NextResponse.json({ ok: false, message: UNAVAILABLE }, { status: 503 });
  }
}

// PUT /api/templates { templates }   save edited templates (the full set)
export async function PUT(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ ok: false, message: "Too large." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, message: "Body must be JSON." }, { status: 400 });
  }
  const parsed = parseTemplates((body as { templates?: unknown } | null)?.templates);
  if (!parsed.ok) return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  try {
    await saveTemplates(getSupabaseAdmin(), parsed.templates);
    return NextResponse.json({ templates: parsed.templates, customized: true });
  } catch {
    return NextResponse.json({ ok: false, message: UNAVAILABLE }, { status: 503 });
  }
}

// DELETE /api/templates   back to the default templates
export async function DELETE() {
  try {
    await resetTemplates(getSupabaseAdmin());
    return NextResponse.json({ templates: mergeTemplates(null), customized: false });
  } catch {
    return NextResponse.json({ ok: false, message: UNAVAILABLE }, { status: 503 });
  }
}
