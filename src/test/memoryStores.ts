import type { SettingsStore } from "@/lib/server/settings";
import type { UsageStore } from "@/lib/server/usage";

// In-memory stand-ins for the Supabase stores, for orchestration tests.

export interface MemoryUsageEvent {
  id: number;
  status: "reserved" | "success" | "failure";
  errorCategory: string | null;
}

export function createMemoryUsageStore(): UsageStore & { events: MemoryUsageEvent[] } {
  const events: MemoryUsageEvent[] = [];
  return {
    events,
    async countThisMonth() {
      return events.length;
    },
    async reserve({ limit }) {
      if (events.length + 1 > limit) return { ok: false, reason: "monthly_limit_reached" };
      const id = events.length + 1;
      events.push({ id, status: "reserved", errorCategory: null });
      return { ok: true, eventId: id };
    },
    async complete(eventId, { success, errorCategory }) {
      const event = events.find((e) => e.id === eventId);
      if (!event) return;
      event.status = success ? "success" : "failure";
      event.errorCategory = errorCategory;
    },
  };
}

export function createMemorySettingsStore(): SettingsStore {
  let paused = false;
  return {
    async isSearchPaused() {
      return paused;
    },
    async setSearchPaused(value) {
      paused = value;
    },
  };
}
