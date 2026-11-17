import { NextResponse } from "next/server";
import { threadStatus } from "@/lib/gmail/replies";
import { GmailNotFoundError, getThreadMeta, labelThread, sentThreadIds } from "@/lib/server/gmail/api";
import { gmailConfig } from "@/lib/server/gmail/config";
import { GmailAuthError } from "@/lib/server/gmail/oauth";
import {
  clearTokenCache,
  forgetThread,
  gmailSession,
  GmailNotConnectedError,
  markReplyCheck,
  markThread,
  recentlyContactedEmails,
  recordFoundThread,
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
// Sent-mail searches per click: one per listed email of a recently contacted lead.
const MAX_SENT_SEARCHES = 30;
const CONCURRENCY = 5;
const limiter = createRateLimiter({ limit: 6, windowMs: 10 * 60_000 });

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

// POST /api/gmail/replies   "Sync with Gmail":
//   1. finds emails you sent to recently contacted leads (Sent mail, ids only),
//   2. puts those conversations under the HUNTPIN label,
//   3. checks them for replies (labels and From header only); a contacted lead
//      that got a reply moves to "Replied".
export async function POST() {
  const config = gmailConfig();
  if (config.kind !== "on") return fail("Gmail is not set up on this server.", 503);
  if (!limiter.tryAcquire(Date.now())) return fail("Checked recently. Wait a few minutes.", 429);

  const supabase = getSupabaseAdmin();
  try {
    const session = await gmailSession(supabase, config);
    const contacts = await recentlyContactedEmails(supabase, MAX_SENT_SEARCHES);
    for (let i = 0; i < contacts.length; i += CONCURRENCY) {
      await Promise.all(
        contacts.slice(i, i + CONCURRENCY).map(async ({ placeId, email }) => {
          for (const threadId of await sentThreadIds(session.token, email)) {
            await recordFoundThread(supabase, threadId, placeId);
          }
        }),
      );
    }
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
    // Error codes only (e.g. gmail_403); never tokens or message content.
    console.error("gmail_sync_failed", error instanceof Error ? error.message : "unknown");
    if (error instanceof GmailNotConnectedError) return fail("Gmail is not connected. Connect it on the Templates page.", 409);
    if (error instanceof GmailAuthError) {
      // Access ended in the Google account: drop the cached token; the next try refreshes it.
      clearTokenCache();
      return fail("Gmail refused access. Try again; if it keeps failing, reconnect Gmail on the Templates page.", 409);
    }
    return fail("Gmail could not be checked. Try again later.", 502);
  }
}
