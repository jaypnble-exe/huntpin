import { describe, expect, it, vi } from "vitest";
import { createSettingsStore } from "./settings";
import { createSupabaseAdmin } from "./supabase";
import { createUsageStore } from "./usage";

// Exercises the real Supabase client against a mocked HTTP layer.
const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test_only",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setup(handler: (url: URL, init: RequestInit) => Response | Promise<Response>) {
  const fetchFn = vi.fn<typeof fetch>(async (input, init = {}) =>
    handler(new URL(String(input instanceof Request ? input.url : input)), init),
  );
  const supabase = createSupabaseAdmin(ENV, fetchFn);
  return { fetchFn, usage: createUsageStore(supabase), settings: createSettingsStore(supabase) };
}

function headerOf(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}

describe("createSupabaseAdmin", () => {
  it("throws when Supabase is not configured", () => {
    expect(() => createSupabaseAdmin({})).toThrow("Supabase is not configured");
    expect(() => createSupabaseAdmin({ NEXT_PUBLIC_SUPABASE_URL: ENV.NEXT_PUBLIC_SUPABASE_URL })).toThrow();
  });
});

describe("Supabase usage store", () => {
  it("reserves through the atomic database function", async () => {
    const { fetchFn, usage } = setup(() => json(7));
    const result = await usage.reserve({ limit: 10, sku: "Text Search Essentials (IDs Only)", eventType: "places_text_search" });

    expect(result).toEqual({ ok: true, eventId: 7 });
    const [input, init] = fetchFn.mock.calls[0];
    expect(String(input)).toBe(`${ENV.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/reserve_places_request`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      p_limit: 10,
      p_sku: "Text Search Essentials (IDs Only)",
      p_event_type: "places_text_search",
    });
    expect(headerOf(init!, "apikey")).toBe(ENV.SUPABASE_SECRET_KEY);
  });

  it("reports the monthly limit when the function returns null", async () => {
    const { usage } = setup(() => json(null));
    expect(await usage.reserve({ limit: 1, sku: "x", eventType: "t" })).toEqual({
      ok: false,
      reason: "monthly_limit_reached",
    });
  });

  it.each([
    ["an HTTP error", () => json({ message: "boom" }, 500)],
    ["a network failure", () => Promise.reject(new TypeError("fetch failed"))],
    ["an unexpected value", () => json("not-a-number")],
  ])("throws on %s so the search fails closed", async (_label, handler) => {
    const { usage } = setup(handler);
    await expect(usage.reserve({ limit: 10, sku: "x", eventType: "t" })).rejects.toThrow();
  });

  it("reads the monthly count", async () => {
    const { usage } = setup((url) =>
      url.pathname.endsWith("/rpc/places_requests_this_month") ? json(3) : json({}, 404),
    );
    expect(await usage.countThisMonth()).toBe(3);
  });

  it("throws when the count cannot be read", async () => {
    const { usage } = setup(() => json({ message: "down" }, 503));
    await expect(usage.countThisMonth()).rejects.toThrow();
  });

  it("records the outcome of a request", async () => {
    const { fetchFn, usage } = setup(() => new Response(null, { status: 204 }));
    await usage.complete(7, { success: false, errorCategory: "timeout" });
    const [input, init] = fetchFn.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe("/rest/v1/usage_events");
    expect(url.searchParams.get("id")).toBe("eq.7");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toMatchObject({ status: "failure", error_category: "timeout" });
  });
});

describe("Supabase settings store", () => {
  function settingsResponse(value: string | null) {
    return (_url: URL, init: RequestInit) => {
      const wantsObject = headerOf(init, "Accept")?.includes("vnd.pgrst.object");
      if (value === null) return wantsObject ? json(null) : json([]);
      return wantsObject ? json({ value }) : json([{ value }]);
    };
  }

  it("reads the pause flag", async () => {
    expect(await setup(settingsResponse("true")).settings.isSearchPaused()).toBe(true);
    expect(await setup(settingsResponse("false")).settings.isSearchPaused()).toBe(false);
    expect(await setup(settingsResponse(null)).settings.isSearchPaused()).toBe(false);
  });

  it("throws when settings cannot be read", async () => {
    const { settings } = setup(() => json({ message: "down" }, 503));
    await expect(settings.isSearchPaused()).rejects.toThrow();
  });
});
