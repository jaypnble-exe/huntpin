import { describe, expect, it } from "vitest";
import {
  dailyLimit,
  dedupeByPhone,
  DEFAULT_QUEUE_QUERY,
  parseQueueQuery,
  phoneKey,
  reachableBy,
  startOfLocalDay,
  toQueueParams,
} from "./queue";

describe("parseQueueQuery", () => {
  it("uses safe defaults and round-trips", () => {
    expect(parseQueueQuery(new URLSearchParams())).toEqual({ ok: true, query: DEFAULT_QUEUE_QUERY });
    const query = { ...DEFAULT_QUEUE_QUERY, category: "food" as const, minScore: 70, channel: "whatsapp" as const };
    expect(parseQueueQuery(toQueueParams(query))).toEqual({ ok: true, query });
  });

  it("rejects unknown values", () => {
    expect(parseQueueQuery(new URLSearchParams("category=weapons")).ok).toBe(false);
    expect(parseQueueQuery(new URLSearchParams("presence=everything")).ok).toBe(false);
    expect(parseQueueQuery(new URLSearchParams("minScore=101")).ok).toBe(false);
    expect(parseQueueQuery(new URLSearchParams("minScore=5.5")).ok).toBe(false);
    expect(parseQueueQuery(new URLSearchParams("channel=sms")).ok).toBe(false);
  });
});

describe("dailyLimit", () => {
  it("defaults to 20 and caps at 50", () => {
    expect(dailyLimit(undefined)).toBe(20);
    expect(dailyLimit("abc")).toBe(20);
    expect(dailyLimit("0")).toBe(20);
    expect(dailyLimit("10")).toBe(10);
    expect(dailyLimit("500")).toBe(50);
  });
});

describe("phoneKey", () => {
  it("matches the same Saudi number in different formats", () => {
    expect(phoneKey("+966 12 345 6789")).toBe("123456789");
    expect(phoneKey("0123456789")).toBe("123456789");
    expect(phoneKey("00966-12-345-6789")).toBe("123456789");
    expect(phoneKey("12")).toBeNull();
  });
});

describe("reachableBy", () => {
  const phoneOnly = { phones: ["+966500000000"], emails: [] };
  const emailOnly = { phones: [], emails: ["a@b.sa"] };
  it("respects the chosen channel", () => {
    expect(reachableBy(phoneOnly, "whatsapp")).toBe(true);
    expect(reachableBy(phoneOnly, "email")).toBe(false);
    expect(reachableBy(emailOnly, "any")).toBe(true);
    expect(reachableBy({ phones: [], emails: [] }, "any")).toBe(false);
  });
});

describe("dedupeByPhone", () => {
  it("drops candidates sharing a phone with a contacted lead or an earlier candidate", () => {
    const a = { id: "a", phones: ["+966 50 111 2222"] };
    const b = { id: "b", phones: ["0501112222"] }; // same number as a
    const c = { id: "c", phones: ["0503334444"] }; // already contacted
    const d = { id: "d", phones: [] }; // email only
    const e = { id: "e", phones: ["0505556666"] };
    expect(dedupeByPhone([a, b, c, d, e], [phoneKey("+966503334444")!], 10).map((x) => x.id)).toEqual(["a", "d", "e"]);
    expect(dedupeByPhone([a, d, e], [], 2).map((x) => x.id)).toEqual(["a", "d"]);
  });
});

describe("startOfLocalDay", () => {
  it("is midnight in Riyadh (UTC+3)", () => {
    expect(startOfLocalDay(new Date("2026-10-30T22:30:00Z")).toISOString()).toBe("2026-10-30T21:00:00.000Z");
    expect(startOfLocalDay(new Date("2026-10-30T10:00:00Z")).toISOString()).toBe("2026-10-29T21:00:00.000Z");
  });
});
