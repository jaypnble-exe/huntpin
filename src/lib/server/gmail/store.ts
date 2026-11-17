import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmails, plusAddress } from "@/lib/places/emails";
import { ensureLabel } from "./api";
import { BCC_TAG, GMAIL_LABEL, type GmailConfig } from "./config";
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
  tokenCache.value = undefined;
}

/**
 * Where the BCC copy of each outreach email goes: OUTREACH_BCC if set, else
 * the connected Gmail address with +huntpin. Null when neither is known.
 */
export function outreachBcc(connectedEmail: string | null, env: Record<string, string | undefined> = process.env): string | null {
  const [configured] = normalizeEmails(env.OUTREACH_BCC ? [env.OUTREACH_BCC] : []);
  if (configured) return configured;
  return connectedEmail ? plusAddress(connectedEmail, BCC_TAG) : null;
}

// Short-lived access token, kept in memory only.
const tokenCache = { value: undefined as { email: string; accessToken: string; expiresAt: number } | undefined };

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
  const cached = tokenCache.value;
  if (cached && cached.email === connection.email && cached.expiresAt - 60_000 > Date.now()) {
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
      tokenCache.value = { email: connection.email, ...fresh };
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
  patch: { sent?: boolean; replied?: boolean },
  now = new Date(),
): Promise<void> {
  const update: Record<string, unknown> = { last_checked_at: now.toISOString() };
  if (patch.sent) update.sent_seen_at = now.toISOString();
  if (patch.replied) update.replied_at = now.toISOString();
  const { error } = await supabase.from("gmail_threads").update(update).eq("thread_id", threadId);
  if (error) throw new Error("gmail_thread_write_failed");
}

export async function forgetThread(supabase: SupabaseClient, threadId: string): Promise<void> {
  const { error } = await supabase.from("gmail_threads").delete().eq("thread_id", threadId);
  if (error) throw new Error("gmail_thread_write_failed");
}

export async function markReplyCheck(supabase: SupabaseClient, now = new Date()): Promise<void> {
  await updateConnection(supabase, { last_reply_check_at: now.toISOString() });
}
