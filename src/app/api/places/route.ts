import { NextResponse, type NextRequest } from "next/server";
import { parsePlaceQuery } from "@/lib/places/filters";
import { queryPlaces } from "@/lib/server/placesStore";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reads the imported open places data. Makes no Google requests.
export async function GET(request: NextRequest) {
  const parsed = parsePlaceQuery(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  }
  try {
    const collection = await queryPlaces(getSupabaseAdmin(), parsed.bbox, parsed.filters);
    return NextResponse.json(collection);
  } catch {
    return NextResponse.json({ ok: false, message: "Places could not be loaded." }, { status: 503 });
  }
}
