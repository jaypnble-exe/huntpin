import "server-only";
import { loadConfig } from "./config";
import { getDatabase } from "./db";
import { FIELD_TIERS, type FieldTier } from "./places/fieldMasks";
import { createSettingsStore } from "./settings";
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
}

/** Dashboard summary. Never includes the API key. */
export function getUsageStatus(now = new Date()): UsageStatus {
  const configResult = loadConfig();
  const config = configResult.ok ? configResult.config : null;

  let used: number | null = null;
  let paused = false;
  let trackingAvailable = true;
  try {
    const db = getDatabase();
    used = createUsageStore(db).countThisMonth(now);
    paused = createSettingsStore(db).isSearchPaused();
  } catch {
    trackingAvailable = false;
  }

  const tier = config?.fieldTier ?? null;
  const limit = config?.maxPlacesRequestsPerMonth ?? null;
  return {
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
}
