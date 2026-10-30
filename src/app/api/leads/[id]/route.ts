import { NextResponse } from "next/server";
import { parseLeadPatch } from "@/lib/leads/leads";
import { deleteLead, isValidLeadId, NotFoundError, updateLead } from "@/lib/server/leadsStore";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const UNAVAILABLE = "Leads are unavailable. Check Supabase and that migration 003 has been run.";

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  if (!isValidLeadId(id)) return NextResponse.json({ ok: false, message: "Invalid lead ID." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body must be JSON." }, { status: 400 });
  }
  const parsed = parseLeadPatch(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });

  try {
    const lead = await updateLead(getSupabaseAdmin(), id, parsed.patch, parsed.markContacted);
    return NextResponse.json({ lead });
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ ok: false, message: "Lead not found." }, { status: 404 });
    return NextResponse.json({ ok: false, message: UNAVAILABLE }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!isValidLeadId(id)) return NextResponse.json({ ok: false, message: "Invalid lead ID." }, { status: 400 });
  try {
    const deleted = await deleteLead(getSupabaseAdmin(), id);
    if (!deleted) return NextResponse.json({ ok: false, message: "Lead not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: UNAVAILABLE }, { status: 503 });
  }
}
