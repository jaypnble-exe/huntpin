import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHAIN_MIN_LOCATIONS } from "../places/leadScore";
import type { WebPresence } from "../places/webPresence";
import type { SummaryLead } from "../leads/weeklySummary";

export async function getSummaryLeads(supabase: SupabaseClient): Promise<SummaryLead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("lead_status,created_at,updated_at,first_contacted_at,last_contacted_at,follow_up_on,follow_up_count")
    .limit(5000);
  if (error) throw new Error("summary_leads_failed");
  return data as SummaryLead[];
}

export interface SuggestedPlace {
  id: string;
  name: string | null;
  basic_category: string | null;
  web_presence: WebPresence;
  lead_score: number;
  lat: number;
  lon: number;
}

/** Best-scoring places not yet saved as leads (chains excluded). */
export async function getSuggestedPlaces(supabase: SupabaseClient, limit = 10): Promise<SuggestedPlace[]> {
  const { data, error } = await supabase
    .from("places")
    .select("id,name,basic_category,web_presence,lead_score,lat,lon,lead:leads(id)")
    .is("lead", null)
    .lt("chain_size", CHAIN_MIN_LOCATIONS)
    .order("lead_score", { ascending: false })
    .order("id")
    .limit(limit);
  if (error) throw new Error("summary_places_failed");
  return (data as (SuggestedPlace & { lead: unknown })[]).map(({ lead: _lead, ...place }) => place);
}
