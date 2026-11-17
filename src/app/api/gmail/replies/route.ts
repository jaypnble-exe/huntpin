import { NextResponse } from "next/server";
import { threadStatus } from "@/lib/gmail/replies";
import { GmailNotFoundError, getThreadMeta, labelThread } from "@/lib/server/gmail/api";
import { gmailConfig } from "@/lib/server/gmail/config";
import {
  forgetThread,
  gmailSession,
  GmailNotConnectedError,
  markReplyCheck,
  markThread,
  threadsToCheck,
  type TrackedThread,
} from "@/lib/server/gmail/store";
import { getLeadForPlace, updateLead } from "@/lib/server/leadsStore";
import { createRateLimiter } from "@/lib/server/rateLimit";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Operator-clicked only, never scheduled. A small batch per click.
const MAX_THREADS_PER_CHECK = 25;
const CONCURRENCY = 5;
const limiter = createRateLimiter({ limit: 6, windowMs: 10 * 60_000 });

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

// POST /api/gmail/replies   checks HuntPin's Gmail conversations for replies.
//   Reads only labels and the From header. A lead that was contacted and got a
//   reply moves to "Replied". Sent conversations get the HUNTPIN label.
export async function POST() {
  const config = gmailConfig();
  if (config.kind !== "on") return fail("Gmail is not set up on this server.", 503);
  if (!limiter.tryAcquire(Date.now())) return fail("Checked recently. Wait a few minutes.", 429);

  const supabase = getSupabaseAdmin();
  try {
    const session = await gmailSession(supabase, config);
    const threads = await threadsToCheck(supabase, MAX_THREADS_PER_CHECK);
    const replies: { leadId: string | null; name: string | null; updated: boolean }[] = [];
    let sent = 0;

    async function check(thread: TrackedThread) {
      let messages;
      try {
        messages = await getThreadMeta(session.token, thread.thread_id);
      } catch (error) {
        // The draft was discarded before sending.
        if (error instanceof GmailNotFoundError) return forgetThread(supabase, thread.thread_id);
        throw error;
      }
      const status = threadStatus(messages, session.email);
      if (status.sent) {
        sent += 1;
        await labelThread(session.token, thread.thread_id, session.labelId).catch(() => undefined);
      }
      await markThread(supabase, thread.thread_id, status);
      if (!status.replied) return;
      const lead = await getLeadForPlace(supabase, thread.place_id);
      const waiting = lead !== null && (lead.lead_status === "contacted" || lead.lead_status === "follow_up");
      if (lead && waiting) await updateLead(supabase, lead.id, { lead_status: "replied" }, false);
      replies.push({ leadId: lead?.id ?? null, name: lead?.label ?? null, updated: waiting });
    }

    for (let i = 0; i < threads.length; i += CONCURRENCY) {
      await Promise.all(threads.slice(i, i + CONCURRENCY).map(check));
    }
    await markReplyCheck(supabase);
    return NextResponse.json({ ok: true, checked: threads.length, sent, replies });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return fail("Gmail is not connected. Connect it on the Templates page.", 409);
    return fail("Gmail could not be checked. Try again later.", 502);
  }
}
