import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmails } from "@/lib/places/emails";
import { CONTACTED_STATUSES } from "@/lib/leads/leads";
import { ensureLabel } from "./api";
import { GMAIL_LABEL, type GmailConfig } from "./config";
import { decryptSecret } from "./crypto";
import { GmailAuthError, refreshAccessToken, revokeToken } from "./oauth";

// The one connected Gmail account (encrypted refresh token) and the
// conversations HuntPin started, so replies can be found later.
// Both tables are server-only (RLS on, no policies).

export interface GmailConnection {
  email: string;
  refresh_token_enc: string;
  label_id: string | null;
  connected_at: string;
  last_reply_check_at: string | null;
}

export class GmailNotConnectedError extends Error {}

export async function getConnection(supabase: SupabaseClient): Promise<GmailConnection | null> {
  const { data, error } = await supabase
    .from("gmail_connection")
    .select("email,refresh_token_enc,label_id,connected_at,last_reply_check_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error("gmail_connection_read_failed");
  return data as GmailConnection | null;
}

export async function saveConnection(
  supabase: SupabaseClient,
  c: { email: string; refreshTokenEnc: string; labelId: string | null },
): Promise<void> {
  const { error } = await supabase.from("gmail_connection").upsert({
    id: 1,
    email: c.email,
    refresh_token_enc: c.refreshTokenEnc,
    label_id: c.labelId,
    connected_at: new Date().toISOString(),
    last_reply_check_at: null,
  });
  if (error) throw new Error("gmail_connection_write_failed");
}

async function updateConnection(supabase: SupabaseClient, patch: Partial<GmailConnection>): Promise<void> {
  const { error } = await supabase.from("gmail_connection").update(patch).eq("id", 1);
  if (error) throw new Error("gmail_connection_write_failed");
}

export async function deleteConnection(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.from("gmail_connection").delete().eq("id", 1);
  if (error) throw new Error("gmail_connection_write_failed");
  clearTokenCache();
}

/** Forget the in-memory access token (after Gmail answers 401). */
export function clearTokenCache(): void {
  tokenCache.value = undefined;
}

/**
 * Optional BCC on outreach emails (OUTREACH_BCC), e.g. for a mail app that
 * isn't Gmail. Gmail doesn't run filters on mail you BCC to yourself, so the
 * HUNTPIN label comes from "Sync with Gmail" instead.
 */
export function outreachBcc(env: Record<string, string | undefined> = process.env): string | null {
  const [configured] = normalizeEmails(env.OUTREACH_BCC ? [env.OUTREACH_BCC] : []);
  return configured ?? null;
}

// Short-lived access token, kept in memory only.
// Keyed by the connection time, so reconnecting never reuses an old token.
const tokenCache = { value: undefined as { key: string; accessToken: string; expiresAt: number } | undefined };

export interface GmailSession {
  email: string;
  labelId: string;
  token: string;
}

/** An access token for the connected account, refreshing it when needed. */
export async function gmailSession(
  supabase: SupabaseClient,
  config: Extract<GmailConfig, { kind: "on" }>,
): Promise<GmailSession> {
  const connection = await getConnection(supabase);
  if (!connection) throw new GmailNotConnectedError("gmail_not_connected");

  let token: string;
  const cacheKey = `${connection.email}|${connection.connected_at}`;
  const cached = tokenCache.value;
  if (cached && cached.key === cacheKey && cached.expiresAt - 60_000 > Date.now()) {
    token = cached.accessToken;
  } else {
    let refreshToken: string;
    try {
      refreshToken = decryptSecret(connection.refresh_token_enc, config.tokenKey);
    } catch {
      // GMAIL_TOKEN_KEY changed: the stored token can't be used.
      throw new GmailNotConnectedError("gmail_token_unreadable");
    }
    try {
      const fresh = await refreshAccessToken({ clientId: config.clientId, clientSecret: config.clientSecret, refreshToken });
      tokenCache.value = { key: cacheKey, ...fresh };
      token = fresh.accessToken;
    } catch (error) {
      if (error instanceof GmailAuthError) {
        await deleteConnection(supabase).catch(() => undefined);
        throw new GmailNotConnectedError("gmail_access_revoked");
      }
      throw error;
    }
  }

  let labelId = connection.label_id;
  if (!labelId) {
    labelId = await ensureLabel(token, GMAIL_LABEL);
    await updateConnection(supabase, { label_id: labelId });
  }
  return { email: connection.email, labelId, token };
}

/** Disconnects: revokes the token at Google (best effort) and deletes it here. */
export async function disconnect(supabase: SupabaseClient, config: GmailConfig): Promise<void> {
  const connection = await getConnection(supabase);
  if (connection && config.kind === "on") {
    try {
      await revokeToken(decryptSecret(connection.refresh_token_enc, config.tokenKey));
    } catch {
      // Unreadable token: deleting it is still the right thing.
    }
  }
  await deleteConnection(supabase);
}

export async function recordThread(
  supabase: SupabaseClient,
  t: { threadId: string; placeId: string; messageId: string },
): Promise<void> {
  const { error } = await supabase
    .from("gmail_threads")
    .upsert({ thread_id: t.threadId, place_id: t.placeId, draft_message_id: t.messageId }, { onConflict: "thread_id" });
  if (error) throw new Error("gmail_thread_write_failed");
}

/** Remembers a conversation found in Sent mail; keeps an existing record as is. */
export async function recordFoundThread(supabase: SupabaseClient, threadId: string, placeId: string): Promise<void> {
  const { error } = await supabase
    .from("gmail_threads")
    .upsert({ thread_id: threadId, place_id: placeId }, { onConflict: "thread_id", ignoreDuplicates: true });
  if (error) throw new Error("gmail_thread_write_failed");
}

/** Listed emails of leads contacted in the last 60 days, most recent first. */
export async function recentlyContactedEmails(
  supabase: SupabaseClient,
  limit: number,
  now = new Date(),
): Promise<{ placeId: string; email: string }[]> {
  const since = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("leads")
    .select("overture_place_id,place:places(emails)")
    .in("lead_status", [...CONTACTED_STATUSES])
    .gte("last_contacted_at", since)
    .not("overture_place_id", "is", null)
    .order("last_contacted_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("leads_read_failed");
  const out: { placeId: string; email: string }[] = [];
  for (const row of (data ?? []) as unknown as { overture_place_id: string; place: { emails: string[] | null } | null }[]) {
    for (const email of normalizeEmails(row.place?.emails ?? [])) {
      out.push({ placeId: row.overture_place_id, email });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export interface TrackedThread {
  thread_id: string;
  place_id: string;
}

/** Conversations from the last 60 days with no reply found yet, newest first. */
export async function threadsToCheck(supabase: SupabaseClient, limit: number, now = new Date()): Promise<TrackedThread[]> {
  const since = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("gmail_threads")
    .select("thread_id,place_id")
    .is("replied_at", null)
    .gte("created_at", since)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error("gmail_threads_read_failed");
  return (data ?? []) as TrackedThread[];
}

export async function markThread(
  supabase: SupabaseClient,
  threadId: string,
  patch: { sent?: boolean; replied?: boolean; lastReplyAt?: number | null },
  now = new Date(),
): Promise<void> {
  const update: Record<string, unknown> = { last_checked_at: now.toISOString() };
  if (patch.sent) update.sent_seen_at = now.toISOString();
  if (patch.replied) update.replied_at = new Date(patch.lastReplyAt ?? now.getTime()).toISOString();
  const { error } = await supabase.from("gmail_threads").update(update).eq("thread_id", threadId);
  if (error) throw new Error("gmail_thread_write_failed");
}

export async function forgetThread(supabase: SupabaseClient, threadId: string): Promise<void> {
  const { error } = await supabase.from("gmail_threads").delete().eq("thread_id", threadId);
  if (error) throw new Error("gmail_thread_write_failed");
}

export interface ReplyRow {
  threadId: string;
  repliedAt: string;
  placeId: string;
  name: string | null;
  lead: { id: string; label: string | null; status: string } | null;
}

/** Conversations where the business replied, newest reply first. */
export async function listReplies(supabase: SupabaseClient, limit = 200): Promise<ReplyRow[]> {
  const { data: threads, error } = await supabase
    .from("gmail_threads")
    .select("thread_id,place_id,replied_at")
    .not("replied_at", "is", null)
    .order("replied_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("gmail_threads_read_failed");
  const rows = (threads ?? []) as { thread_id: string; place_id: string; replied_at: string }[];
  const placeIds = [...new Set(rows.map((t) => t.place_id))];
  if (placeIds.length === 0) return [];

  const [places, leads] = await Promise.all([
    supabase.from("places").select("id,name").in("id", placeIds),
    supabase.from("leads").select("id,label,lead_status,overture_place_id").in("overture_place_id", placeIds),
  ]);
  if (places.error || leads.error) throw new Error("replies_read_failed");
  const names = new Map((places.data ?? []).map((p) => [p.id as string, (p.name as string | null) ?? null]));
  const leadsByPlace = new Map(
    (leads.data ?? []).map((l) => [
      l.overture_place_id as string,
      { id: l.id as string, label: (l.label as string | null) ?? null, status: l.lead_status as string },
    ]),
  );
  return rows.map((t) => ({
    threadId: t.thread_id,
    repliedAt: t.replied_at,
    placeId: t.place_id,
    name: names.get(t.place_id) ?? null,
    lead: leadsByPlace.get(t.place_id) ?? null,
  }));
}

export async function markReplyCheck(supabase: SupabaseClient, now = new Date()): Promise<void> {
  await updateConnection(supabase, { last_reply_check_at: now.toISOString() });
}
