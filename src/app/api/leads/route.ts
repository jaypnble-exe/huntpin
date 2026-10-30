import { NextResponse, type NextRequest } from "next/server";
import { parseLeadListQuery } from "@/lib/leads/listFilters";
import { createLeadFromPlace, getLeadForPlace, listLeads, NotFoundError } from "@/lib/server/leadsStore";
import { isValidPlaceId } from "@/lib/server/placesStore";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = "Leads are unavailable. Check Supabase and that migration 003 has been run.";

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

// POST /api/leads { placeId }   save an imported place as a lead
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
  try {
    const { lead, created } = await createLeadFromPlace(getSupabaseAdmin(), placeId);
    return NextResponse.json({ lead, created }, { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ ok: false, message: "Place not found." }, { status: 404 });
    return NextResponse.json({ ok: false, message: UNAVAILABLE }, { status: 503 });
  }
}
