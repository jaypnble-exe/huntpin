import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORY_GROUPS } from "../places/categories";
import { CHAIN_MIN_LOCATIONS } from "../places/leadScore";
import {
  dedupeByPhone,
  phoneKey,
  QUEUE_BLOCKED_STATUSES,
  QUEUE_SIZE,
  reachableBy,
  startOfLocalDay,
  type QueueQuery,
} from "../leads/queue";
import {
  createLeadFromPlace,
  getLead,
  getLeadForPlace,
  listLeads,
  NotFoundError,
  PLACE_COLUMNS,
  updateLead,
  type Lead,
  type LeadPlace,
} from "./leadsStore";

export interface QueueItem {
  kind: "first" | "follow_up";
  placeId: string;
  /** The saved lead, or null for a place not saved yet. */
  lead: Lead | null;
  place: LeadPlace;
}

export interface Queue {
  followUps: QueueItem[];
  fresh: QueueItem[];
  contactedToday: number;
  dailyLimit: number;
}

export class QueueLimitError extends Error {}
export class QueueBlockedError extends Error {}

const PAGE_SIZE = 1000;
const MAX_TAKEN_ROWS = 10_000;

function timeZone(): string | undefined {
  return process.env.APP_TIME_ZONE || undefined;
}

/** First messages sent today (leads first contacted since local midnight). */
export async function countContactedToday(supabase: SupabaseClient, now = new Date()): Promise<number> {
  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .gte("first_contacted_at", startOfLocalDay(now, timeZone()).toISOString());
  if (error || count === null) throw new Error("queue_count_failed");
  return count;
}

/** Phone keys of leads that already had (or must not get) a first message. */
async function takenPhoneKeys(supabase: SupabaseClient): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let from = 0; from < MAX_TAKEN_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("leads")
      .select("id,place:places(phones)")
      .not("lead_status", "in", "(new,reviewed)")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("queue_taken_failed");
    for (const row of data as unknown as { place: { phones: string[] } | null }[]) {
      for (const phone of row.place?.phones ?? []) {
        const key = phoneKey(phone);
        if (key) keys.add(key);
      }
    }
    if (data.length < PAGE_SIZE) break;
  }
  return keys;
}

/** Best unsaved places for first messages, strongest first. */
async function unsavedCandidates(supabase: SupabaseClient, query: QueueQuery): Promise<(LeadPlace & { id: string })[]> {
  let q = supabase
    .from("places")
    .select(`id,${PLACE_COLUMNS},lead:leads(id)`)
    .is("lead", null)
    .in("web_presence", query.presence)
    .gte("lead_score", query.minScore)
    .lt("chain_size", CHAIN_MIN_LOCATIONS);
  if (query.category) q = q.in("basic_category", [...CATEGORY_GROUPS[query.category].categories]);
  if (query.channel === "whatsapp") q = q.neq("phones", "{}");
  else if (query.channel === "email") q = q.neq("emails", "{}");
  else q = q.or("phones.neq.{},emails.neq.{}");
  const { data, error } = await q
    .order("lead_score", { ascending: false })
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("id")
    .limit(QUEUE_SIZE * 3);
  if (error) throw new Error("queue_places_failed");
  return (data as unknown as (LeadPlace & { id: string; lead: unknown })[]).map(({ lead: _lead, ...place }) => place);
}

/**
 * The queue: due follow-ups, then first messages. Saved leads not contacted
 * yet come before unsaved places; anyone sharing a phone number with a lead
 * already contacted (or opted out) is left out.
 */
export async function buildQueue(
  supabase: SupabaseClient,
  query: QueueQuery,
  limit: number,
  now = new Date(),
): Promise<Queue> {
  const [due, saved, taken, unsaved, contactedToday] = await Promise.all([
    listLeads(supabase, { statuses: [], presence: [], category: query.category, due: true }),
    listLeads(supabase, { statuses: ["new", "reviewed"], presence: [], category: query.category }),
    takenPhoneKeys(supabase),
    unsavedCandidates(supabase, query),
    countContactedToday(supabase, now),
  ]);

  const followUps: QueueItem[] = due
    .filter((lead) => lead.place && lead.overture_place_id && reachableBy(lead.place, query.channel))
    .map((lead) => ({ kind: "follow_up", placeId: lead.overture_place_id!, lead, place: lead.place! }));

  const savedItems: QueueItem[] = saved
    .filter((lead) => lead.place && lead.overture_place_id && reachableBy(lead.place, query.channel))
    .sort((a, b) => b.place!.lead_score - a.place!.lead_score)
    .map((lead) => ({ kind: "first", placeId: lead.overture_place_id!, lead, place: lead.place! }));
  const unsavedItems: QueueItem[] = unsaved.map(({ id, ...place }) => ({ kind: "first", placeId: id, lead: null, place }));

  const fresh = dedupeByPhone(
    [...savedItems, ...unsavedItems].map((item) => ({ ...item, phones: item.place.phones })),
    taken,
    QUEUE_SIZE,
  ).map(({ phones: _phones, ...item }) => item);

  return { followUps, fresh, contactedToday, dailyLimit: limit };
}

/**
 * Records that the operator sent a message themselves: saves the place as a
 * lead if needed and marks it contacted (which sets the follow-up reminder).
 * Refuses opted-out leads, and first messages beyond the daily limit.
 */
export async function recordSent(
  supabase: SupabaseClient,
  target: { leadId: string } | { placeId: string },
  limit: number,
  now = new Date(),
): Promise<{ lead: Lead; contactedToday: number }> {
  let lead = "leadId" in target ? await getLead(supabase, target.leadId) : await getLeadForPlace(supabase, target.placeId);
  if ("leadId" in target && !lead) throw new NotFoundError("lead_not_found");
  if (lead && QUEUE_BLOCKED_STATUSES.includes(lead.lead_status)) throw new QueueBlockedError("lead_blocked");

  const isFirst = !lead?.first_contacted_at;
  if (isFirst && (await countContactedToday(supabase, now)) >= limit) throw new QueueLimitError("daily_limit_reached");

  if (!lead) lead = (await createLeadFromPlace(supabase, (target as { placeId: string }).placeId)).lead;
  const updated = await updateLead(supabase, lead.id, {}, true, now);
  return { lead: updated, contactedToday: await countContactedToday(supabase, now) };
}
