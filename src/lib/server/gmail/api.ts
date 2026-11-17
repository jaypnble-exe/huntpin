import "server-only";
import type { ThreadMessageMeta } from "@/lib/gmail/replies";
import { GmailAuthError } from "./oauth";

// The few Gmail API calls HuntPin makes. Message bodies are never read.
const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const TIMEOUT_MS = 10_000;

export class GmailNotFoundError extends Error {}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 401) throw new GmailAuthError("gmail_401");
  if (response.status === 404) throw new GmailNotFoundError("gmail_not_found");
  if (!response.ok) throw new Error(`gmail_${response.status}`);
  return (await response.json()) as T;
}

export async function getProfileEmail(token: string): Promise<string> {
  const profile = await call<{ emailAddress?: string }>(token, "/profile");
  if (!profile.emailAddress) throw new Error("gmail_profile_missing");
  return profile.emailAddress.toLowerCase();
}

/** The id of the label with this name, creating it if needed. */
export async function ensureLabel(token: string, name: string): Promise<string> {
  const { labels = [] } = await call<{ labels?: { id: string; name: string }[] }>(token, "/labels");
  const existing = labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const created = await call<{ id: string }>(token, "/labels", {
    method: "POST",
    body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }),
  });
  return created.id;
}

export async function createDraft(token: string, raw: string): Promise<{ draftId: string; messageId: string; threadId: string }> {
  const draft = await call<{ id: string; message: { id: string; threadId: string } }>(token, "/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw } }),
  });
  return { draftId: draft.id, messageId: draft.message.id, threadId: draft.message.threadId };
}

export async function labelMessage(token: string, messageId: string, labelId: string): Promise<void> {
  await call(token, `/messages/${encodeURIComponent(messageId)}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: [labelId] }),
  });
}

export async function labelThread(token: string, threadId: string, labelId: string): Promise<void> {
  await call(token, `/threads/${encodeURIComponent(threadId)}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: [labelId] }),
  });
}

/** A conversation's labels and its From / Auto-Submitted headers only. */
export async function getThreadMeta(token: string, threadId: string): Promise<ThreadMessageMeta[]> {
  // "fields" leaves out the snippet (part of the body), which Gmail sends by default.
  const params = new URLSearchParams({ format: "metadata", fields: "messages(labelIds,payload/headers)" });
  params.append("metadataHeaders", "From");
  params.append("metadataHeaders", "Auto-Submitted");
  const thread = await call<{ messages?: ThreadMessageMeta[] }>(token, `/threads/${encodeURIComponent(threadId)}?${params}`);
  return thread.messages ?? [];
}

/** Opens one draft in Gmail on the web, signed in as the connected account. */
export function draftUrl(email: string, messageId: string): string {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#drafts?compose=${encodeURIComponent(messageId)}`;
}
