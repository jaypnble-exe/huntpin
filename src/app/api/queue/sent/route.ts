import { NextResponse } from "next/server";
import { dailyLimit } from "@/lib/leads/queue";
import { isValidLeadId, NotFoundError } from "@/lib/server/leadsStore";
import { isValidPlaceId } from "@/lib/server/placesStore";
import { QueueBlockedError, QueueLimitError, recordSent } from "@/lib/server/queueStore";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/queue/sent { leadId } | { placeId }
// The operator already sent the message from their own app; this only records it.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body must be JSON." }, { status: 400 });
  }
  const record = (typeof body === "object" && body !== null && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const keys = Object.keys(record);
  let target: { leadId: string } | { placeId: string };
  if (keys.length === 1 && typeof record.leadId === "string" && isValidLeadId(record.leadId)) {
    target = { leadId: record.leadId };
  } else if (keys.length === 1 && typeof record.placeId === "string" && isValidPlaceId(record.placeId)) {
    target = { placeId: record.placeId };
  } else {
    return NextResponse.json({ ok: false, message: "Send exactly one of leadId or placeId." }, { status: 400 });
  }

  const limit = dailyLimit(process.env.DAILY_OUTREACH_LIMIT);
  try {
    return NextResponse.json(await recordSent(getSupabaseAdmin(), target, limit));
  } catch (error) {
    if (error instanceof QueueLimitError) {
      return NextResponse.json(
        { ok: false, message: `Daily limit reached: ${limit} first messages today. Follow-ups still work; new businesses wait until tomorrow.` },
        { status: 429 },
      );
    }
    if (error instanceof QueueBlockedError) {
      return NextResponse.json({ ok: false, message: "This lead replied, declined, opted out or has a deal in progress; it is not messaged from the queue." }, { status: 409 });
    }
    if (error instanceof NotFoundError) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: false, message: "Could not record. Check Supabase." }, { status: 503 });
  }
}
