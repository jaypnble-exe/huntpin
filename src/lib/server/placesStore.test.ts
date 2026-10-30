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
    });

    const url = new URL(String(fetchFn.mock.calls[0][0]));
    const params = url.searchParams;
    expect(url.pathname).toBe("/rest/v1/places");
    expect(params.getAll("lon")).toEqual(["gte.39.13", "lte.39.17"]);
    expect(params.getAll("lat")).toEqual(["gte.21.57", "lte.21.6"]);
    expect(params.get("web_presence")).toBe("in.(social_only,no_website_listed)");
    expect(params.get("confidence")).toBe("gte.0.5");
    expect(params.get("has_instagram")).toBe("eq.true");
    expect(params.get("basic_category")).toBe("in.(hotel,lodging,resort)");
    expect(params.get("name")).toBe("ilike.%50\\%\\_off\\*%");
    expect(params.get("order")).toBe("confidence.desc.nullslast,id.asc");

    expect(result.truncated).toBe(false);
    expect(result.features[0]).toEqual({
      type: "Feature",
      id: "p0",
      geometry: { type: "Point", coordinates: [39.15, 21.58] },
      properties: { id: "p0", name: "Place 0", presence: "social_only", instagram: true, category: "cafe" },
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
