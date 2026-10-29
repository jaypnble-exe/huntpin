import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Reservation =
  | { ok: true; eventId: number }
  | { ok: false; reason: "monthly_limit_reached" };

/** All methods throw when tracking is unavailable, so callers fail closed. */
export interface UsageStore {
  /** Requests recorded in the current UTC calendar month. */
  countThisMonth(): Promise<number>;
  /** Atomically checks the monthly limit and records one attempted request. */
  reserve(args: { limit: number; sku: string; eventType: string }): Promise<Reservation>;
  complete(eventId: number, outcome: { success: boolean; errorCategory: string | null }): Promise<void>;
}

// The limit check and insert run inside the reserve_places_request database
// function (supabase/migrations/001_initial.sql), so they are atomic.
export function createUsageStore(supabase: SupabaseClient): UsageStore {
  return {
    async countThisMonth() {
      const { data, error } = await supabase.rpc("places_requests_this_month");
      if (error || typeof data !== "number") throw new Error("usage_count_failed");
      return data;
    },

    async reserve({ limit, sku, eventType }) {
      const { data, error } = await supabase.rpc("reserve_places_request", {
        p_limit: limit,
        p_sku: sku,
        p_event_type: eventType,
      });
      if (error) throw new Error("usage_reserve_failed");
      if (data === null) return { ok: false, reason: "monthly_limit_reached" };
      const eventId = Number(data);
      if (!Number.isSafeInteger(eventId)) throw new Error("usage_reserve_failed");
      return { ok: true, eventId };
    },

    async complete(eventId, { success, errorCategory }) {
      const { error } = await supabase
        .from("usage_events")
        .update({
          status: success ? "success" : "failure",
          error_category: errorCategory,
          completed_at: new Date().toISOString(),
        })
        .eq("id", eventId);
      if (error) throw new Error("usage_complete_failed");
    },
  };
}
