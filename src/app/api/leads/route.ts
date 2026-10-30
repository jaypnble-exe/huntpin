import { NextResponse, type NextRequest } from "next/server";
import { parseLeadListQuery } from "@/lib/leads/listFilters";
import { createLeadFromPlace, getLeadForPlace, listLeads, markPlaceNotAFit, NotFoundError } from "@/lib/server/leadsStore";
import { normalizeWebsiteUrl } from "@/lib/server/websiteCheck";
import { isValidPlaceId } from "@/lib/server/placesStore";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = "Leads are unavailable. Check Supabase and that every file in supabase/migrations (up to 010) has been run.";

// GET /api/leads?status=&presence=&category=   list leads
// GET /api/leads?placeId=<id>                   the lead for one place (or null)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const placeId = params.get("placeId");
  try {
    if (placeId !== null) {
      if (!isValidPlaceId(placeId)) return NextResponse.json({ ok: false, message: "Invalid place ID." }, { status: 400 });
      return NextResponse.json({ lead: await getLeadForPlace(getSupabaseAdmin(), placeId) });
    }
    const parsed = parseLeadListQuery(params);
    if (!parsed.ok) return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
    return NextResponse.json({ leads: await listLeads(getSupabaseAdmin(), parsed.query) });
  } catch {
    return NextResponse.json({ ok: false, message: UNAVAILABLE }, { status: 503 });
  }
}

// POST /api/leads { placeId }                              save an imported place as a lead
// POST /api/leads { placeId, notAFit: { websiteUrl? } }   mark it Not a fit (has a website); hides it
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body must be JSON." }, { status: 400 });
  }
  const placeId = (body as { placeId?: unknown } | null)?.placeId;
  if (typeof placeId !== "string" || !isValidPlaceId(placeId)) {
    return NextResponse.json({ ok: false, message: "placeId is required." }, { status: 400 });
  }
  const notAFit = (body as { notAFit?: unknown }).notAFit;
  if (notAFit !== undefined) {
    if (typeof notAFit !== "object" || notAFit === null || Array.isArray(notAFit)) {
      return NextResponse.json({ ok: false, message: "notAFit must be an object." }, { status: 400 });
    }
    const raw = (notAFit as { websiteUrl?: unknown }).websiteUrl;
    let websiteUrl: string | null = null;
    if (typeof raw === "string" && raw.trim()) {
      const normalized = normalizeWebsiteUrl(raw);
      if (!normalized.ok) return NextResponse.json({ ok: false, message: normalized.error }, { status: 400 });
      websiteUrl = normalized.url.href;
    } else if (raw !== undefined && raw !== null && raw !== "") {
      return NextResponse.json({ ok: false, message: "websiteUrl must be a string." }, { status: 400 });
    }
    try {
      return NextResponse.json({ lead: await markPlaceNotAFit(getSupabaseAdmin(), placeId, websiteUrl) });
    } catch (error) {
      if (error instanceof NotFoundError) return NextResponse.json({ ok: false, message: "Place not found." }, { status: 404 });
      return NextResponse.json({ ok: false, message: UNAVAILABLE }, { status: 503 });
    }
  }

  try {
    const { lead, created } = await createLeadFromPlace(getSupabaseAdmin(), placeId);
    return NextResponse.json({ lead, created }, { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ ok: false, message: "Place not found." }, { status: 404 });
    return NextResponse.json({ ok: false, message: UNAVAILABLE }, { status: 503 });
  }
}
