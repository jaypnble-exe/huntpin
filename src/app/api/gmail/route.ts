import { NextResponse } from "next/server";
import { gmailConfig } from "@/lib/server/gmail/config";
import { disconnect, getConnection, outreachBcc } from "@/lib/server/gmail/store";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = "Gmail settings are unavailable. Check Supabase and that supabase/migrations/011_gmail.sql has been run.";

// GET /api/gmail   whether Gmail is set up and connected, and the BCC address for email drafts
export async function GET() {
  const config = gmailConfig();
  const base = {
    configured: config.kind === "on",
    problem: config.kind === "misconfigured" ? config.reason : null,
  };
  if (config.kind !== "on") return NextResponse.json({ ...base, connected: false, email: null, bcc: outreachBcc() });
  try {
    const connection = await getConnection(getSupabaseAdmin());
    return NextResponse.json({
      ...base,
      connected: connection !== null,
      email: connection?.email ?? null,
      lastReplyCheckAt: connection?.last_reply_check_at ?? null,
      bcc: outreachBcc(),
    });
  } catch {
    return NextResponse.json({ ...base, connected: false, email: null, bcc: outreachBcc(), problem: UNAVAILABLE });
  }
}

// DELETE /api/gmail   disconnect: revoke HuntPin's access and delete the stored token
export async function DELETE() {
  try {
    await disconnect(getSupabaseAdmin(), gmailConfig());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: UNAVAILABLE }, { status: 503 });
  }
}
