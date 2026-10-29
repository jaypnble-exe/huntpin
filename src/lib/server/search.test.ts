import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemorySettingsStore, createMemoryUsageStore } from "@/test/memoryStores";
import { loadConfig } from "./config";
import { TEXT_SEARCH_URL } from "./places/textSearch";
import { createRateLimiter } from "./rateLimit";
import { runSearch, type SearchDeps } from "./search";
import type { UsageStore } from "./usage";

// Integration tests: real config parsing, in-memory stores, mocked Google.
const API_KEY = "TEST-KEY-never-real";
const ENABLED_ENV = {
  PLACES_SEARCH_ENABLED: "true",
  GOOGLE_MAPS_API_KEY: API_KEY,
  MAX_RESULTS_PER_SEARCH: "10",
  MAX_PLACES_REQUESTS_PER_MONTH: "2",
};
const BODY = { niche: "restaurants", location: "Jeddah", maxResults: 5, confirmed: true };
const NOW = new Date("2026-10-29T10:00:00Z");

function googleResponse(json: unknown, status = 200) {
  return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
}

let fetchFn: ReturnType<typeof vi.fn<typeof fetch>>;
let deps: SearchDeps & { usage: ReturnType<typeof createMemoryUsageStore> };

function makeDeps(env: Record<string, string> = ENABLED_ENV) {
  return {
    config: loadConfig(env),
    usage: createMemoryUsageStore(),
    settings: createMemorySettingsStore(),
    rateLimiter: createRateLimiter({ limit: 100, windowMs: 60_000 }),
    fetchFn,
    now: () => NOW,
  };
}

beforeEach(() => {
  fetchFn = vi.fn<typeof fetch>(async () =>
    googleResponse({ places: [{ id: "place-1" }, { id: "place-2" }] }),
  );
  deps = makeDeps();
});

describe("runSearch safety checks (no Google request)", () => {
  it("does not call Google when the kill switch is off", async () => {
    const outcome = await runSearch(BODY, makeDeps({ ...ENABLED_ENV, PLACES_SEARCH_ENABLED: "false" }));
    expect(outcome.status).toBe(403);
    expect(outcome.body).toMatchObject({ ok: false, error: "search_disabled" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("does not call Google when config is invalid", async () => {
    const { MAX_PLACES_REQUESTS_PER_MONTH: _, ...missingLimit } = ENABLED_ENV;
    const outcome = await runSearch(BODY, makeDeps(missingLimit));
    expect(outcome.body).toMatchObject({ error: "config_invalid" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects searches over the result limit", async () => {
    const outcome = await runSearch({ ...BODY, maxResults: 11 }, deps);
    expect(outcome.status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation", async () => {
    const outcome = await runSearch({ ...BODY, confirmed: false }, deps);
    expect(outcome.body).toMatchObject({ error: "confirmation_required" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses while searches are paused", async () => {
    await deps.settings.setSearchPaused(true);
    const outcome = await runSearch(BODY, deps);
    expect(outcome.status).toBe(423);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses when usage tracking is unavailable", async () => {
    const broken: UsageStore = {
      countThisMonth: () => {
        throw new Error("db down");
      },
      reserve: () => {
        throw new Error("db down");
      },
      complete: async () => {},
    };
    const outcome = await runSearch(BODY, { ...deps, usage: broken });
    expect(outcome.status).toBe(503);
    expect(outcome.body).toMatchObject({ error: "usage_tracking_unavailable" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses once the monthly limit is reached", async () => {
    expect((await runSearch(BODY, deps)).status).toBe(200);
    expect((await runSearch(BODY, deps)).status).toBe(200);
    const third = await runSearch(BODY, deps);
    expect(third.body).toMatchObject({ error: "monthly_limit_reached" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("applies the rate limit", async () => {
    deps.rateLimiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    await runSearch(BODY, deps);
    const second = await runSearch(BODY, deps);
    expect(second.body).toMatchObject({ error: "rate_limited" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("runSearch Google request", () => {
  it("sends exactly one request with the ID-only field mask and no pagination", async () => {
    const outcome = await runSearch(BODY, deps);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(TEXT_SEARCH_URL);
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Goog-FieldMask"]).toBe("places.id");
    expect(headers["X-Goog-Api-Key"]).toBe(API_KEY);
    expect(JSON.parse(init?.body as string)).toEqual({ textQuery: "restaurants in Jeddah", pageSize: 5 });
    expect(outcome.body).toEqual({
      ok: true,
      places: [
        { placeId: "place-1", displayName: null, formattedAddress: null },
        { placeId: "place-2", displayName: null, formattedAddress: null },
      ],
      fieldTier: "ids_only",
      sku: "Text Search Essentials (IDs Only)",
      usage: { used: 1, limit: 2 },
    });
  });

  it("uses the pro mask only when opted in, and parses names and addresses", async () => {
    fetchFn.mockResolvedValueOnce(
      googleResponse({
        places: [{ id: "p1", displayName: { text: "Café One", languageCode: "en" }, formattedAddress: "Jeddah" }],
      }),
    );
    const outcome = await runSearch(BODY, makeDeps({ ...ENABLED_ENV, PLACES_FIELD_TIER: "pro" }));
    const headers = fetchFn.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["X-Goog-FieldMask"]).toBe("places.id,places.displayName,places.formattedAddress");
    expect(outcome.body).toMatchObject({
      ok: true,
      sku: "Text Search Pro",
      places: [{ placeId: "p1", displayName: "Café One", formattedAddress: "Jeddah" }],
    });
  });

  it("removes duplicate place IDs and never returns more than requested", async () => {
    fetchFn.mockResolvedValueOnce(
      googleResponse({ places: [{ id: "a" }, { id: "a" }, { id: "b" }, { id: "c" }], nextPageToken: "t" }),
    );
    const outcome = await runSearch({ ...BODY, maxResults: 2 }, deps);
    expect(outcome.body.ok && outcome.body.places.map((p) => p.placeId)).toEqual(["a", "b"]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("handles an empty result", async () => {
    fetchFn.mockResolvedValueOnce(googleResponse({}));
    const outcome = await runSearch(BODY, deps);
    expect(outcome.body).toMatchObject({ ok: true, places: [] });
  });

  it.each([
    [429, "quota_exceeded"],
    [403, "permission_denied"],
    [400, "invalid_request"],
    [500, "upstream_error"],
  ])("maps HTTP %i to %s without retrying, and counts the attempt", async (status, category) => {
    fetchFn.mockResolvedValueOnce(googleResponse({ error: { message: "nope" } }, status));
    const outcome = await runSearch(BODY, deps);
    expect(outcome.status).toBe(502);
    expect(outcome.body).toMatchObject({ error: "places_request_failed" });
    expect((outcome.body as { message: string }).message).toContain(category);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(deps.usage.events).toEqual([{ id: 1, status: "failure", errorCategory: category }]);
  });

  it("handles timeouts, network errors, and malformed responses", async () => {
    fetchFn.mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }));
    expect(JSON.stringify((await runSearch(BODY, deps)).body)).toContain("timeout");

    deps = makeDeps({ ...ENABLED_ENV, MAX_PLACES_REQUESTS_PER_MONTH: "10" });
    fetchFn.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(JSON.stringify((await runSearch(BODY, deps)).body)).toContain("network_error");

    fetchFn.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    expect(JSON.stringify((await runSearch(BODY, deps)).body)).toContain("malformed_response");

    fetchFn.mockResolvedValueOnce(googleResponse({ places: [{ name: "no id" }] }));
    expect(JSON.stringify((await runSearch(BODY, deps)).body)).toContain("malformed_response");
  });

  it("never exposes the API key in responses", async () => {
    fetchFn.mockRejectedValueOnce(new Error(`boom ${API_KEY}`));
    const outcome = await runSearch(BODY, deps);
    expect(JSON.stringify(outcome)).not.toContain(API_KEY);
    const success = await runSearch(BODY, deps);
    expect(JSON.stringify(success)).not.toContain(API_KEY);
  });
});

describe("runSearch usage recording", () => {
  it("marks the reserved request as successful", async () => {
    await runSearch(BODY, deps);
    expect(deps.usage.events).toEqual([{ id: 1, status: "success", errorCategory: null }]);
  });

  it("still returns results if recording the outcome fails", async () => {
    const usage = createMemoryUsageStore();
    usage.complete = async () => {
      throw new Error("db down");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const outcome = await runSearch(BODY, { ...deps, usage });
    expect(outcome.status).toBe(200);
    expect(usage.events).toHaveLength(1);
    warn.mockRestore();
  });
});
