// Outreach queue: one business at a time, draft ready, the operator sends it
// from their own WhatsApp or mail app and presses "Sent". Nothing here sends
// anything. Shared by the browser (query string) and the server (validation).
import { isCategoryGroup, type CategoryGroup } from "../places/categories";
import { WEB_PRESENCE, type WebPresence } from "../places/webPresence";
import { DEFAULT_TIME_ZONE, localDate } from "./followUps";
import type { LeadStatus } from "./leads";

export const QUEUE_CHANNELS = ["any", "whatsapp", "email"] as const;
export type QueueChannel = (typeof QUEUE_CHANNELS)[number];

/** New businesses per queue load. Small on purpose: personal, low-volume outreach. */
export const QUEUE_SIZE = 20;
export const DEFAULT_DAILY_LIMIT = 20;
export const MAX_DAILY_LIMIT = 50;

export interface QueueQuery {
  category: CategoryGroup | null;
  presence: WebPresence[];
  minScore: number;
  channel: QueueChannel;
}

export const DEFAULT_QUEUE_QUERY: QueueQuery = {
  category: null,
  presence: ["social_only", "no_website_listed", "unknown"],
  minScore: 60,
  channel: "any",
};

export const MIN_SCORE_OPTIONS = [0, 40, 50, 60, 70, 80] as const;

export function toQueueParams(query: QueueQuery): URLSearchParams {
  const params = new URLSearchParams({
    presence: query.presence.join(","),
    minScore: String(query.minScore),
    channel: query.channel,
  });
  if (query.category) params.set("category", query.category);
  return params;
}

export function parseQueueQuery(params: URLSearchParams): { ok: true; query: QueueQuery } | { ok: false; error: string } {
  const category = params.get("category");
  if (category !== null && category !== "" && !isCategoryGroup(category)) return { ok: false, error: "unknown category" };

  const presenceRaw = params.get("presence");
  const presence = presenceRaw === null ? DEFAULT_QUEUE_QUERY.presence : presenceRaw.split(",").filter(Boolean);
  if (presence.length === 0 || !presence.every((p) => (WEB_PRESENCE as readonly string[]).includes(p))) {
    return { ok: false, error: "presence must list one or more valid labels" };
  }

  const minScore = Number(params.get("minScore") ?? DEFAULT_QUEUE_QUERY.minScore);
  if (!Number.isInteger(minScore) || minScore < 0 || minScore > 100) {
    return { ok: false, error: "minScore must be a whole number from 0 to 100" };
  }

  const channel = params.get("channel") ?? "any";
  if (!(QUEUE_CHANNELS as readonly string[]).includes(channel)) return { ok: false, error: "channel must be any, whatsapp or email" };

  return {
    ok: true,
    query: {
      category: category ? (category as CategoryGroup) : null,
      presence: [...new Set(presence)] as WebPresence[],
      minScore,
      channel: channel as QueueChannel,
    },
  };
}

/** Daily cap on first messages, from DAILY_OUTREACH_LIMIT (1-50, default 20). */
export function dailyLimit(raw: string | undefined): number {
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value < 1) return DEFAULT_DAILY_LIMIT;
  return Math.min(value, MAX_DAILY_LIMIT);
}

/**
 * Key for spotting the same business behind different records (Overture and
 * Foursquare, or branches sharing a number): the last 9 digits, which is the
 * Saudi national number without the 0 or +966 prefix.
 */
export function phoneKey(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-9) : null;
}

export function reachableBy(place: { phones: string[]; emails: string[] }, channel: QueueChannel): boolean {
  if (channel === "whatsapp") return place.phones.length > 0;
  if (channel === "email") return place.emails.length > 0;
  return place.phones.length > 0 || place.emails.length > 0;
}

/** Statuses that never get a message from the queue. */
export const QUEUE_BLOCKED_STATUSES: readonly LeadStatus[] = [
  "not_interested",
  "do_not_contact",
  "not_a_fit",
  "replied",
  "meeting",
  "proposal_sent",
  "won",
  "lost",
];

/**
 * Keeps candidates in order, dropping any whose phone number already belongs
 * to a saved lead (or to an earlier candidate), so nobody gets two first
 * messages because they appear twice in the data.
 */
export function dedupeByPhone<T extends { phones: string[] }>(candidates: T[], takenPhones: Iterable<string>, limit: number): T[] {
  const taken = new Set(takenPhones);
  const out: T[] = [];
  for (const candidate of candidates) {
    if (out.length >= limit) break;
    const keys = candidate.phones.map(phoneKey).filter((k): k is string => k !== null);
    if (keys.some((k) => taken.has(k))) continue;
    keys.forEach((k) => taken.add(k));
    out.push(candidate);
  }
  return out;
}

/** UTC instant of midnight on `date` (YYYY-MM-DD) in the given time zone. */
export function startOfLocalDay(now: Date, timeZone = DEFAULT_TIME_ZONE): Date {
  const date = localDate(now, timeZone);
  const utcMidnight = new Date(`${date}T00:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(utcMidnight)
      .map((p) => [p.type, p.value]),
  );
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(utcMidnight.getTime() - (asLocal - utcMidnight.getTime()));
}
