import "server-only";
import type { DatabaseSync } from "node:sqlite";

export type Reservation =
  | { ok: true; eventId: number }
  | { ok: false; reason: "monthly_limit_reached" };

export interface UsageStore {
  countThisMonth(now: Date): number;
  /** Atomically checks the monthly limit and records one attempted request. */
  reserve(args: { now: Date; limit: number; sku: string; eventType: string }): Reservation;
  complete(
    eventId: number,
    outcome: { success: boolean; errorCategory: string | null; now: Date },
  ): void;
}

// The app counter uses UTC calendar months. Google's billing month may use a
// different timezone, which is one more reason this counter is only a safeguard.
export function monthStartUtc(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function createUsageStore(db: DatabaseSync): UsageStore {
  function countThisMonth(now: Date): number {
    const row = db
      .prepare(
        "SELECT COALESCE(SUM(request_count), 0) AS total FROM usage_events WHERE created_at >= ?",
      )
      .get(monthStartUtc(now)) as { total: number | bigint };
    return Number(row.total);
  }

  return {
    countThisMonth,

    reserve({ now, limit, sku, eventType }) {
      db.exec("BEGIN IMMEDIATE");
      try {
        if (countThisMonth(now) + 1 > limit) {
          db.exec("ROLLBACK");
          return { ok: false, reason: "monthly_limit_reached" };
        }
        // Reserved rows count toward the limit even if the call later fails,
        // because a failed request may still be billed.
        const result = db
          .prepare(
            `INSERT INTO usage_events (event_type, request_count, sku_if_known, status, created_at)
             VALUES (?, 1, ?, 'reserved', ?)`,
          )
          .run(eventType, sku, now.toISOString());
        db.exec("COMMIT");
        return { ok: true, eventId: Number(result.lastInsertRowid) };
      } catch (error) {
        if (db.isTransaction) db.exec("ROLLBACK");
        throw error;
      }
    },

    complete(eventId, { success, errorCategory, now }) {
      db.prepare(
        "UPDATE usage_events SET status = ?, error_category = ?, completed_at = ? WHERE id = ?",
      ).run(success ? "success" : "failure", errorCategory, now.toISOString(), eventId);
    },
  };
}
