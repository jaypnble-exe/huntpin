import { describe, expect, it } from "vitest";
import { openDatabase } from "./db";
import { createSettingsStore } from "./settings";
import { createUsageStore, monthStartUtc } from "./usage";

const SKU = "Text Search Essentials (IDs Only)";

describe("usage store", () => {
  it("reserves up to the limit and then refuses", () => {
    const usage = createUsageStore(openDatabase(":memory:"));
    const now = new Date("2026-10-15T12:00:00Z");
    for (let i = 0; i < 3; i++) {
      expect(usage.reserve({ now, limit: 3, sku: SKU, eventType: "test" }).ok).toBe(true);
    }
    expect(usage.reserve({ now, limit: 3, sku: SKU, eventType: "test" })).toEqual({
      ok: false,
      reason: "monthly_limit_reached",
    });
    expect(usage.countThisMonth(now)).toBe(3);
  });

  it("refuses everything when the limit is 0", () => {
    const usage = createUsageStore(openDatabase(":memory:"));
    expect(usage.reserve({ now: new Date(), limit: 0, sku: SKU, eventType: "test" }).ok).toBe(false);
  });

  it("counts failed requests toward the limit", () => {
    const usage = createUsageStore(openDatabase(":memory:"));
    const now = new Date("2026-10-15T12:00:00Z");
    const reservation = usage.reserve({ now, limit: 1, sku: SKU, eventType: "test" });
    if (!reservation.ok) throw new Error("expected reservation");
    usage.complete(reservation.eventId, { success: false, errorCategory: "timeout", now });
    expect(usage.reserve({ now, limit: 1, sku: SKU, eventType: "test" }).ok).toBe(false);
  });

  it("resets at the start of the next UTC month", () => {
    const usage = createUsageStore(openDatabase(":memory:"));
    usage.reserve({ now: new Date("2026-10-31T23:59:59Z"), limit: 1, sku: SKU, eventType: "test" });
    expect(usage.reserve({ now: new Date("2026-10-31T23:59:59Z"), limit: 1, sku: SKU, eventType: "test" }).ok).toBe(false);
    expect(usage.reserve({ now: new Date("2026-11-01T00:00:00Z"), limit: 1, sku: SKU, eventType: "test" }).ok).toBe(true);
  });

  it("computes the UTC month start", () => {
    expect(monthStartUtc(new Date("2026-02-14T05:00:00Z"))).toBe("2026-02-01T00:00:00.000Z");
  });

  it("throws (so callers fail closed) when the database is closed", () => {
    const db = openDatabase(":memory:");
    const usage = createUsageStore(db);
    db.close();
    expect(() => usage.reserve({ now: new Date(), limit: 10, sku: SKU, eventType: "test" })).toThrow();
  });
});

describe("settings store", () => {
  it("is not paused by default and persists the pause flag", () => {
    const settings = createSettingsStore(openDatabase(":memory:"));
    expect(settings.isSearchPaused()).toBe(false);
    settings.setSearchPaused(true, new Date());
    expect(settings.isSearchPaused()).toBe(true);
    settings.setSearchPaused(false, new Date());
    expect(settings.isSearchPaused()).toBe(false);
  });
});
