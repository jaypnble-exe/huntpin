import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORY_GROUPS, type CategoryGroup } from "../places/categories";
import type { WebPresence } from "../places/webPresence";
import type { LeadPatch, LeadStatus } from "../leads/leads";
import type { WebsiteSignals } from "../websiteSignals";
import type { WebsiteCheckResult, WebsiteCheckStatus } from "./websiteCheck";

export const MAX_LEADS_LISTED = 1000;

export interface LeadPlace {
  name: string | null;
  basic_category: string | null;
  web_presence: WebPresence;
  has_instagram: boolean;
  phones: string[];
  websites: string[];
  socials: string[];
  lat: number;
  lon: number;
  area: string;
  source_datasets: string[];
  source_licenses: string[];
  lead_score: number;
  chain_size: number;
}

export interface Lead {
  id: string;
  label: string | null;
  operator_notes: string | null;
  lead_status: LeadStatus;
  first_contacted_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
  overture_place_id: string | null;
  website_url: string | null;
  website_status: "not_listed" | WebsiteCheckStatus | null;
  website_http_status: number | null;
  website_final_url: string | null;
  website_error_category: string | null;
  website_signals: WebsiteSignals | null;
  website_checked_at: string | null;
  confirmed_opportunities: string[];
  place: LeadPlace | null;
}

export interface LeadListFilters {
  statuses: LeadStatus[];
  presence: WebPresence[];
  category: CategoryGroup | null;
}

const LEAD_COLUMNS =
  "id,label,operator_notes,lead_status,first_contacted_at,last_contacted_at,created_at,updated_at,overture_place_id," +
  "website_url,website_status,website_http_status,website_final_url,website_error_category,website_signals,website_checked_at,confirmed_opportunities";
const PLACE_COLUMNS =
  "name,basic_category,web_presence,has_instagram,phones,websites,socials,lat,lon,area,source_datasets,source_licenses,lead_score,chain_size";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidLeadId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

export class NotFoundError extends Error {}

export async function listLeads(supabase: SupabaseClient, filters: LeadListFilters): Promise<Lead[]> {
  // An inner join is needed when filtering on the linked place.
  const filtersOnPlace = filters.presence.length > 0 || filters.category !== null;
  let query = supabase
    .from("leads")
    .select(`${LEAD_COLUMNS},place:places${filtersOnPlace ? "!inner" : ""}(${PLACE_COLUMNS})`);
  if (filters.statuses.length > 0) query = query.in("lead_status", filters.statuses);
  if (filters.presence.length > 0) query = query.in("place.web_presence", filters.presence);
  if (filters.category) query = query.in("place.basic_category", [...CATEGORY_GROUPS[filters.category].categories]);

  const { data, error } = await query.order("updated_at", { ascending: false }).limit(MAX_LEADS_LISTED);
  if (error) throw new Error("leads_list_failed");
  return data as unknown as Lead[];
}

export async function getLead(supabase: SupabaseClient, id: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select(`${LEAD_COLUMNS},place:places(${PLACE_COLUMNS})`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("lead_read_failed");
  return data as unknown as Lead | null;
}

export async function getLeadForPlace(supabase: SupabaseClient, placeId: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select(`${LEAD_COLUMNS},place:places(${PLACE_COLUMNS})`)
    .eq("overture_place_id", placeId)
    .maybeSingle();
  if (error) throw new Error("lead_read_failed");
  return data as unknown as Lead | null;
}

/**
 * Saves an imported place as a lead. If it is already saved, returns the
 * existing lead (no duplicates; overture_place_id is unique).
 */
export async function createLeadFromPlace(
  supabase: SupabaseClient,
  placeId: string,
): Promise<{ lead: Lead; created: boolean }> {
  const { data: place, error: placeError } = await supabase
    .from("places")
    .select("id,name,basic_category,area")
    .eq("id", placeId)
    .maybeSingle();
  if (placeError) throw new Error("place_read_failed");
  if (!place) throw new NotFoundError("place_not_found");

  const { data, error } = await supabase
    .from("leads")
    .insert({
      overture_place_id: place.id,
      // Open data may be stored, so the place name is a fine default label.
      label: place.name ? String(place.name).slice(0, 120) : null,
      search_niche: place.basic_category ? String(place.basic_category).slice(0, 60) : null,
      search_location: String(place.area).slice(0, 80),
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const existing = await getLeadForPlace(supabase, placeId);
    if (existing) return { lead: existing, created: false };
  }
  if (error || !data) throw new Error("lead_create_failed");

  const lead = await getLead(supabase, data.id);
  if (!lead) throw new Error("lead_create_failed");
  return { lead, created: true };
}

export async function updateLead(
  supabase: SupabaseClient,
  id: string,
  patch: LeadPatch,
  markContacted: boolean,
  now = new Date(),
): Promise<Lead> {
  const update: LeadPatch = { ...patch };
  if (markContacted) {
    const current = await getLead(supabase, id);
    if (!current) throw new NotFoundError("lead_not_found");
    update.last_contacted_at = now.toISOString();
    if (!current.first_contacted_at && update.first_contacted_at === undefined) {
      update.first_contacted_at = now.toISOString();
    }
    if (update.lead_status === undefined && (current.lead_status === "new" || current.lead_status === "reviewed")) {
      update.lead_status = "contacted";
    }
  }

  const { data, error } = await supabase.from("leads").update(update).eq("id", id).select("id");
  if (error) throw new Error("lead_update_failed");
  if (!data || data.length === 0) throw new NotFoundError("lead_not_found");

  const lead = await getLead(supabase, id);
  if (!lead) throw new NotFoundError("lead_not_found");
  return lead;
}

/**
 * Stores a website check: the URL checked, outcome category, HTTP status and
 * final URL. Never stores page content.
 */
export async function saveWebsiteCheck(
  supabase: SupabaseClient,
  id: string,
  checkedUrl: string,
  result: WebsiteCheckResult,
  now = new Date(),
): Promise<Lead> {
  const { data, error } = await supabase
    .from("leads")
    .update({
      website_url: checkedUrl,
      website_status: result.status,
      website_http_status: result.httpStatus,
      website_final_url: result.finalUrl?.slice(0, 2048) ?? null,
      website_error_category: result.errorCategory,
      website_signals: result.signals ?? null,
      website_checked_at: now.toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) throw new Error("website_check_save_failed");
  if (!data || data.length === 0) throw new NotFoundError("lead_not_found");
  const lead = await getLead(supabase, id);
  if (!lead) throw new NotFoundError("lead_not_found");
  return lead;
}

export async function deleteLead(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await supabase.from("leads").delete().eq("id", id).select("id");
  if (error) throw new Error("lead_delete_failed");
  return Boolean(data && data.length > 0);
}
