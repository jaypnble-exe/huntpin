import "server-only";
import type { DatabaseSync } from "node:sqlite";

export interface SettingsStore {
  isSearchPaused(): boolean;
  setSearchPaused(paused: boolean, now: Date): void;
}

const SEARCHES_PAUSED = "searches_paused";

export function createSettingsStore(db: DatabaseSync): SettingsStore {
  return {
    isSearchPaused() {
      const row = db
        .prepare("SELECT value FROM app_settings WHERE key = ?")
        .get(SEARCHES_PAUSED) as { value: string } | undefined;
      return row?.value === "true";
    },

    setSearchPaused(paused, now) {
      db.prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ).run(SEARCHES_PAUSED, String(paused), now.toISOString());
    },
  };
}
