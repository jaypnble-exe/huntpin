import { NextResponse } from "next/server";
import { buildRawMessage, MAX_DRAFT_BODY_LENGTH, MAX_DRAFT_SUBJECT_LENGTH } from "@/lib/gmail/mime";
import { canDraftOutreach } from "@/lib/leads/leads";
import { normalizeEmails } from "@/lib/places/emails";
import { createDraft, draftUrl, labelMessage } from "@/lib/server/gmail/api";
import { gmailConfig } from "@/lib/server/gmail/config";
import { gmailSession, GmailNotConnectedError, outreachBcc, recordThread } from "@/lib/server/gmail/store";
import { getLeadForPlace } from "@/lib/server/leadsStore";
import { isValidPlaceId } from "@/lib/server/placesStore";
import { createRateLimiter } from "@/lib/server/rateLimit";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One draft at a time, created only when the operator clicks.
const limiter = createRateLimiter({ limit: 30, windowMs: 10 * 60_000 });

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

// POST /api/gmail/drafts { placeId, to, subject, body }
//   Creates a draft in the connected Gmail, labelled HUNTPIN, for one listed
//   email of one business. Never sends: the operator sends it in Gmail.
export async function POST(request: Request) {
  const config = gmailConfig();
  if (config.kind !== "on") return fail("Gmail is not set up on this server.", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Body must be JSON.", 400);
  }
  const { placeId, to, subject, body: text } = (body ?? {}) as Record<string, unknown>;
  if (typeof placeId !== "string" || !isValidPlaceId(placeId)) return fail("Invalid place ID.", 400);
  if (typeof subject !== "string" || subject.trim() === "" || subject.length > MAX_DRAFT_SUBJECT_LENGTH) {
    return fail(`Subject must be 1-${MAX_DRAFT_SUBJECT_LENGTH} characters.`, 400);
  }
  if (typeof text !== "string" || text.trim() === "" || text.length > MAX_DRAFT_BODY_LENGTH) {
    return fail(`Message must be 1-${MAX_DRAFT_BODY_LENGTH} characters.`, 400);
  }
  const [recipient] = normalizeEmails(typeof to === "string" ? [to] : []);
  if (!recipient) return fail("Invalid email address.", 400);

  if (!limiter.tryAcquire(Date.now())) return fail("Too many drafts in a short time. Wait a few minutes.", 429);

  const supabase = getSupabaseAdmin();
  try {
    // Only an email listed for this business, and never for opted-out leads.
    const { data: place, error } = await supabase.from("places").select("id,emails").eq("id", placeId).maybeSingle();
    if (error) throw new Error("place_read_failed");
    if (!place) return fail("Business not found.", 404);
    if (!normalizeEmails(place.emails).includes(recipient)) return fail("That email isn't listed for this business.", 400);
    const lead = await getLeadForPlace(supabase, placeId);
    if (lead && !canDraftOutreach(lead.lead_status)) return fail("No drafts for this lead's status.", 409);

    const session = await gmailSession(supabase, config);
    const raw = buildRawMessage({ to: recipient, bcc: outreachBcc(session.email), subject, body: text });
    const draft = await createDraft(session.token, raw);
    // Best effort: the BCC filter and the reply check label the conversation too.
    await labelMessage(session.token, draft.messageId, session.labelId).catch(() => undefined);
    await recordThread(supabase, { threadId: draft.threadId, placeId, messageId: draft.messageId });
    return NextResponse.json({ ok: true, url: draftUrl(session.email, draft.messageId) });
  } catch (error) {
    if (error instanceof GmailNotConnectedError) return fail("Gmail is not connected. Connect it on the Templates page.", 409);
    return fail("The Gmail draft could not be created. Try again, or use the Email button.", 502);
  }
}
