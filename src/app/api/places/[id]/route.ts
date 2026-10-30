import { NextResponse } from "next/server";
import { getPlaceDetails, isValidPlaceId } from "@/lib/server/placesStore";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidPlaceId(id)) {
    return NextResponse.json({ ok: false, message: "Invalid place ID." }, { status: 400 });
  }
  try {
    const place = await getPlaceDetails(getSupabaseAdmin(), id);
    if (!place) return NextResponse.json({ ok: false, message: "Place not found." }, { status: 404 });
    return NextResponse.json(place);
  } catch {
    return NextResponse.json({ ok: false, message: "Place could not be loaded." }, { status: 503 });
  }
}
