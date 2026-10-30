import { NextResponse, type NextRequest } from "next/server";
import { dailyLimit, parseQueueQuery } from "@/lib/leads/queue";
import { buildQueue } from "@/lib/server/queueStore";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/queue?category=&presence=&minScore=&channel=   due follow-ups and the next first messages
export async function GET(request: NextRequest) {
  const parsed = parseQueueQuery(request.nextUrl.searchParams);
  if (!parsed.ok) return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  try {
    const queue = await buildQueue(getSupabaseAdmin(), parsed.query, dailyLimit(process.env.DAILY_OUTREACH_LIMIT));
    return NextResponse.json(queue);
  } catch {
    return NextResponse.json({ ok: false, message: "The queue is unavailable. Check Supabase." }, { status: 503 });
  }
}
