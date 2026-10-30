import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTERS } from "../places/filters";
import { escapeLike, getPlaceDetails, isValidPlaceId, MAX_MAP_FEATURES, queryPlaces } from "./placesStore";
import { createSupabaseAdmin } from "./supabase";

const BBOX = [39.13, 21.57, 39.17, 21.6] as [number, number, number, number];

function row(i: number) {
  return {
    id: `p${i}`,
    name: `Place ${i}`,
    basic_category: "cafe",
    web_presence: "social_only",
    has_instagram: i % 2 === 0,
    lead: i === 0 ? { lead_status: "contacted" } : null,
    lead_score: 80,
    chain_size: i === 1 ? 4 : 1,
    lat: 21.58,
    lon: 39.15,
  };
}

function setup(totalRows: number) {
  // supabase-js sends .range() as offset/limit query parameters.
  const fetchFn = vi.fn<typeof fetch>(async (input) => {
    const params = new URL(String(input)).searchParams;
    const from = Number(params.get("offset") ?? 0);
    const limit = Number(params.get("limit") ?? 1000);
    const rows = Array.from({ length: Math.max(0, Math.min(limit, totalRows - from)) }, (_, i) => row(from + i));
    return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const supabase = createSupabaseAdmin(
    { NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" },
    fetchFn,
  );
  return { fetchFn, supabase };
}

describe("queryPlaces", () => {
  it("filters by bbox, presence and options, and returns GeoJSON", async () => {
    const { fetchFn, supabase } = setup(2);
    const result = await queryPlaces(supabase, BBOX, {
      ...DEFAULT_FILTERS,
      category: "hotels",
      instagramOnly: true,
      nameQuery: "50%_off*",
      saved: "hide",
    });

    const url = new URL(String(fetchFn.mock.calls[0][0]));
    const params = url.searchParams;
    expect(url.pathname).toBe("/rest/v1/places");
    expect(params.getAll("lon")).toEqual(["gte.39.13", "lte.39.17"]);
    expect(params.getAll("lat")).toEqual(["gte.21.57", "lte.21.6"]);
    expect(params.get("web_presence")).toBe("in.(social_only,no_website_listed)");
    expect(params.get("or")).toBe("(confidence.gte.0.5,confidence.is.null)");
    expect(params.get("has_instagram")).toBe("eq.true");
    expect(params.get("basic_category")).toBe("in.(hotel,lodging,resort)");
    expect(params.get("name")).toBe("ilike.%50\\%\\_off\\*%");
    expect(params.get("order")).toBe("lead_score.desc,confidence.desc.nullslast,id.asc");
    expect(params.get("chain_size")).toBe("lt.3");
    expect(params.get("select")).toContain("lead:leads(lead_status)");
    expect(params.get("lead")).toBe("is.null");

    expect(result.truncated).toBe(false);
    expect(result.features[0]).toEqual({
      type: "Feature",
      id: "p0",
      geometry: { type: "Point", coordinates: [39.15, 21.58] },
      properties: { id: "p0", name: "Place 0", presence: "social_only", instagram: true, category: "cafe", leadStatus: "contacted", score: 80, chain: false },
    });
  });

  it("pages through results and stops when a page is short", async () => {
    const { fetchFn, supabase } = setup(2500);
    const result = await queryPlaces(supabase, BBOX, DEFAULT_FILTERS);
    expect(result.features).toHaveLength(2500);
    expect(result.truncated).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("caps the number of features and reports truncation", async () => {
    const { fetchFn, supabase } = setup(20_000);
    const result = await queryPlaces(supabase, BBOX, DEFAULT_FILTERS);
    expect(result.features).toHaveLength(MAX_MAP_FEATURES);
    expect(result.truncated).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(6);
  });

  it("throws on database errors", async () => {
    const supabase = createSupabaseAdmin(
      { NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" },
      async () => new Response(JSON.stringify({ message: "down" }), { status: 500 }),
    );
    await expect(queryPlaces(supabase, BBOX, DEFAULT_FILTERS)).rejects.toThrow();
  });
});

describe("place details", () => {
  it("validates IDs", () => {
    expect(isValidPlaceId("08f2a1b2-c3d4.e5")).toBe(true);
    expect(isValidPlaceId("../etc")).toBe(false);
    expect(isValidPlaceId("a b")).toBe(false);
    expect(isValidPlaceId("")).toBe(false);
  });

  it("returns null when not found", async () => {
    const supabase = createSupabaseAdmin(
      { NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" },
      async (_input, init) =>
        new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object")
          ? new Response(JSON.stringify(null), { status: 200 })
          : new Response("[]", { status: 200 }),
    );
    expect(await getPlaceDetails(supabase, "missing")).toBeNull();
  });

  it("escapes LIKE wildcards", () => {
    expect(escapeLike("a%b_c*d\\e")).toBe("a\\%b\\_c\\*d\\\\e");
  });
});

describe("saved-lead filter", () => {
  it("uses an inner join for saved leads only", async () => {
    const { fetchFn, supabase } = setup(1);
    await queryPlaces(supabase, BBOX, { ...DEFAULT_FILTERS, saved: "only" });
    const params = new URL(String(fetchFn.mock.calls[0][0])).searchParams;
    expect(params.get("select")).toContain("lead:leads!inner(lead_status)");
    expect(params.get("lead")).toBeNull();
  });
});

describe("chains", () => {
  it("includes chains only when asked, and marks them", async () => {
    const { fetchFn, supabase } = setup(2);
    const result = await queryPlaces(supabase, BBOX, { ...DEFAULT_FILTERS, hideChains: false });
    expect(new URL(String(fetchFn.mock.calls[0][0])).searchParams.get("chain_size")).toBeNull();
    expect(result.features[1].properties.chain).toBe(true);
  });
});
