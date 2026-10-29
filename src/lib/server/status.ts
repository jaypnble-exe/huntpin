import "server-only";
import { loadConfig } from "./config";
import { FIELD_TIERS, type FieldTier } from "./places/fieldMasks";
import { createSettingsStore } from "./settings";
import { getSupabaseAdmin } from "./supabase";
import { createUsageStore } from "./usage";

export interface UsageStatus {
  configOk: boolean;
  configErrors: string[];
  searchEnabled: boolean;
  trackingAvailable: boolean;
  paused: boolean;
  fieldTier: FieldTier | null;
  sku: string | null;
  googleFreeMonthlyCap: string | null;
  used: number | null;
  limit: number | null;
  remaining: number | null;
  maxResultsPerSearch: number | null;
  /** Why a search would be refused right now, or null if it would be attempted. */
  searchBlockedReason: string | null;
}

export function searchBlockedReason(
  status: Omit<UsageStatus, "searchBlockedReason">,
): string | null {
  if (!status.configOk) return "Server configuration is invalid.";
  if (!status.trackingAvailable) return "Usage tracking is unavailable.";
  if (!status.searchEnabled) return "Places search is disabled (PLACES_SEARCH_ENABLED is not true).";
  if (status.paused) return "Searches are paused.";
  if (status.remaining === null || status.remaining <= 0) {
    return "The app's monthly request limit has been reached.";
  }
  return null;
}

/** Dashboard summary. Never includes the API key. */
export async function getUsageStatus(): Promise<UsageStatus> {
  const configResult = loadConfig();
  const config = configResult.ok ? configResult.config : null;

  let used: number | null = null;
  let paused = false;
  let trackingAvailable = true;
  try {
    const supabase = getSupabaseAdmin();
    [used, paused] = await Promise.all([
      createUsageStore(supabase).countThisMonth(),
      createSettingsStore(supabase).isSearchPaused(),
    ]);
  } catch {
    trackingAvailable = false;
  }

  const tier = config?.fieldTier ?? null;
  const limit = config?.maxPlacesRequestsPerMonth ?? null;
  const status = {
    configOk: configResult.ok,
    configErrors: configResult.ok ? [] : configResult.errors,
    searchEnabled: config?.placesSearchEnabled ?? false,
    trackingAvailable,
    paused,
    fieldTier: tier,
    sku: tier && FIELD_TIERS[tier].sku,
    googleFreeMonthlyCap: tier && FIELD_TIERS[tier].freeMonthlyCap,
    used,
    limit,
    remaining: used !== null && limit !== null ? Math.max(0, limit - used) : null,
    maxResultsPerSearch: config?.maxResultsPerSearch ?? null,
  };
  return { ...status, searchBlockedReason: searchBlockedReason(status) };
}
