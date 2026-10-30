import { NextResponse } from "next/server";
import { getLead, isValidLeadId, NotFoundError, saveWebsiteCheck } from "@/lib/server/leadsStore";
import { createRateLimiter } from "@/lib/server/rateLimit";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { checkWebsite, normalizeWebsiteUrl } from "@/lib/server/websiteCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual, operator-triggered checks only; this keeps them low-volume.
const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

// POST /api/leads/<id>/website-check { url }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidLeadId(id)) return NextResponse.json({ ok: false, message: "Invalid lead ID." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body must be JSON." }, { status: 400 });
  }
  const rawUrl = (body as { url?: unknown } | null)?.url;
  if (typeof rawUrl !== "string") return NextResponse.json({ ok: false, message: "url is required." }, { status: 400 });
  const normalized = normalizeWebsiteUrl(rawUrl);
  if (!normalized.ok) return NextResponse.json({ ok: false, message: normalized.error }, { status: 400 });

  if (!rateLimiter.tryAcquire(Date.now())) {
    return NextResponse.json({ ok: false, message: "Too many checks. Wait a minute and try again." }, { status: 429 });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!(await getLead(supabase, id))) return NextResponse.json({ ok: false, message: "Lead not found." }, { status: 404 });
    const result = await checkWebsite(normalized.url);
    const lead = await saveWebsiteCheck(supabase, id, normalized.url.href, result);
    return NextResponse.json({ lead, result });
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ ok: false, message: "Lead not found." }, { status: 404 });
    return NextResponse.json({ ok: false, message: "The check could not be saved." }, { status: 503 });
  }
}
