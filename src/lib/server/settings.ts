import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** All methods throw when settings are unavailable, so callers fail closed. */
export interface SettingsStore {
  isSearchPaused(): Promise<boolean>;
  setSearchPaused(paused: boolean): Promise<void>;
}

const SEARCHES_PAUSED = "searches_paused";

export function createSettingsStore(supabase: SupabaseClient): SettingsStore {
  return {
    async isSearchPaused() {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SEARCHES_PAUSED)
        .maybeSingle();
      if (error) throw new Error("settings_read_failed");
      return data?.value === "true";
    },

    async setSearchPaused(paused) {
      const { error } = await supabase.from("app_settings").upsert({
        key: SEARCHES_PAUSED,
        value: String(paused),
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error("settings_write_failed");
    },
  };
}
