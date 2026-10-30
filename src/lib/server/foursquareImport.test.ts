import { describe, expect, it, vi } from "vitest";
import { foursquareQuery, instagramUrl, isBusinessCategory, mapFoursquareCategory, toFoursquarePlaceRow, type FoursquarePlace } from "./foursquareImport";
import { addInstagram, prunePlaces, rescoreArea } from "./rescore";
import { createSupabaseAdmin } from "./supabase";

const OPTS = { area: "Jeddah", release: "fsq-2026-10-30", refreshedSince: "2024-01-01" };
const RAW: FoursquarePlace = {
  fsq_place_id: "4b0588f1f964a520aa2a22e3",
  name: "Olffat Pastries",
  latitude: 21.58,
  longitude: 39.15,
  date_refreshed: "2026-09-28",
  date_closed: null,
  tel: "+966 12 000 0000",
  website: null,
  facebook_id: null,
  instagram: "olffat.sa",
  twitter: null,
  fsq_category_labels: ["Dining and Drinking > Bakery"],
};

describe("Foursquare categories", () => {
  it.each([
    ["Dining and Drinking > Cafe, Coffee, and Tea House > Café", "cafe"],
    ["Dining and Drinking > Cafe, Coffee, and Tea House > Coffee Shop", "coffee_shop"],
    ["Dining and Drinking > Restaurant > Middle Eastern Restaurant", "restaurant"],
    ["Dining and Drinking > Restaurant > Fast Food Restaurant", "fast_food_restaurant"],
    ["Dining and Drinking > Bar > Hookah Bar", "lounge"],
    ["Business and Professional Services > Health and Beauty Service > Hair Salon", "personal_or_beauty_service"],
    ["Health and Medicine > Dentist", "dental_clinic"],
    ["Retail > Fashion Retail > Clothing Store", "fashion_and_apparel_store"],
    ["Business and Professional Services > Office", "professional_service"],
    ["Travel and Transportation > Lodging > Hotel", "hotel"],
  ])("maps %s to %s", (label, category) => {
    expect(mapFoursquareCategory(label)).toBe(category);
  });

  it("keeps businesses and drops roads, buildings and government", () => {
    expect(isBusinessCategory("Retail > Grocery Store")).toBe(true);
    expect(isBusinessCategory("Travel and Transportation > Lodging > Hotel")).toBe(true);
    expect(isBusinessCategory("Travel and Transportation > Road")).toBe(false);
    expect(isBusinessCategory("Community and Government > Residential Building > Apartment or Condo")).toBe(false);
    expect(isBusinessCategory("Landmarks and Outdoors > Structure")).toBe(false);
    expect(isBusinessCategory(null)).toBe(false);
  });
});

describe("toFoursquarePlaceRow", () => {
  it("maps a business with an Instagram handle", () => {
    expect(toFoursquarePlaceRow(RAW, OPTS)).toMatchObject({
      id: "fsq:4b0588f1f964a520aa2a22e3",
      source: "foursquare",
      basic_category: "food_and_beverage_store",
      taxonomy_primary: "Dining and Drinking > Bakery",
      websites: [],
      socials: ["https://www.instagram.com/olffat.sa"],
      phones: ["+966 12 000 0000"],
      web_presence: "social_only",
      has_instagram: true,
      confidence: null,
      refreshed_on: "2026-09-28",
      source_datasets: ["Foursquare"],
      source_licenses: ["Apache-2.0"],
    });
  });

  it("marks places with nothing listed", () => {
    expect(toFoursquarePlaceRow({ ...RAW, instagram: null }, OPTS)?.web_presence).toBe("no_website_listed");
  });

  it("skips closed, stale, non-business and malformed records", () => {
    expect(toFoursquarePlaceRow({ ...RAW, date_closed: "2025-01-01" }, OPTS)).toBeNull();
    expect(toFoursquarePlaceRow({ ...RAW, date_refreshed: "2022-05-01" }, OPTS)).toBeNull();
    expect(toFoursquarePlaceRow({ ...RAW, fsq_category_labels: ["Travel and Transportation > Road"] }, OPTS)).toBeNull();
    expect(toFoursquarePlaceRow({ ...RAW, fsq_place_id: "../x" }, OPTS)).toBeNull();
    expect(toFoursquarePlaceRow({ ...RAW, latitude: "x" }, OPTS)).toBeNull();
  });

  it("only accepts plausible Instagram handles", () => {
    expect(instagramUrl("@cafe.one")).toBe("https://www.instagram.com/cafe.one");
    expect(instagramUrl("javascript:alert(1)")).toBeNull();
    expect(instagramUrl("a b")).toBeNull();
  });

  it("builds a bbox query and rejects bad input", () => {
    expect(foursquareQuery([39.05, 21.25, 39.35, 21.85])).toContain("longitude BETWEEN 39.05 AND 39.35");
    expect(() => foursquareQuery([0, 0, NaN, 1])).toThrow();
  });
});

describe("addInstagram", () => {
  const ROW = {
    id: "o1",
    websites: [],
    socials: ["https://www.facebook.com/1"],
    operating_status: null,
    web_presence: "social_only" as const,
    has_instagram: false,
    source_datasets: ["meta"],
    source_licenses: ["CDLA-Permissive-2.0"],
  };

  it("adds the link and Foursquare attribution", () => {
    expect(addInstagram(ROW, "https://www.instagram.com/x")).toMatchObject({
      socials: ["https://www.facebook.com/1", "https://www.instagram.com/x"],
      has_instagram: true,
      web_presence: "social_only",
      source_datasets: ["meta", "Foursquare"],
      source_licenses: ["CDLA-Permissive-2.0", "Apache-2.0"],
    });
  });

  it("leaves places that already have Instagram alone", () => {
    expect(addInstagram({ ...ROW, has_instagram: true }, "https://www.instagram.com/x")).toBeNull();
  });
});

describe("rescoreArea", () => {
  it("scores across sources and sends batched updates", async () => {
    const rows = [
      { id: "a", name: "Pizza Hut", web_presence: "social_only", has_instagram: false, phones: [], basic_category: "restaurant", confidence: 0.9, refreshed_on: null },
      { id: "fsq:b", name: "PIZZA HUT", web_presence: "no_website_listed", has_instagram: false, phones: [], basic_category: "restaurant", confidence: null, refreshed_on: "2026-01-01" },
      { id: "fsq:c", name: "Pizza-Hut", web_presence: "no_website_listed", has_instagram: false, phones: [], basic_category: "restaurant", confidence: null, refreshed_on: "2026-01-01" },
      { id: "d", name: "Olffat", web_presence: "no_website_listed", has_instagram: true, phones: ["1"], basic_category: "cafe", confidence: null, refreshed_on: "2026-09-01" },
    ];
    const rpcBodies: unknown[] = [];
    const fetchFn = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/rpc/apply_place_scores")) {
        rpcBodies.push(JSON.parse(String(init?.body)));
        return new Response("3", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const supabase = createSupabaseAdmin(
      { NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" },
      fetchFn,
    );
    expect(await rescoreArea(supabase, "Jeddah", undefined, "2026-10-30")).toEqual({ rows: 4, changed: 3 });
    expect(rpcBodies).toEqual([
      {
        p_rows: [
          { id: "a", chain_size: 3, lead_score: 5 },
          { id: "fsq:b", chain_size: 3, lead_score: 5 },
          { id: "fsq:c", chain_size: 3, lead_score: 5 },
          // 35 no website + 15 phone + 10 instagram + 15 target + 10 updated this year
          { id: "d", chain_size: 1, lead_score: 85 },
        ],
      },
    ]);
  });
});

describe("prunePlaces", () => {
  function supabaseWith(existing: number) {
    const calls: string[] = [];
    const fetchFn = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
      if (url.pathname.endsWith("/rpc/prune_places")) return new Response("12", { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response(null, { status: 200, headers: { "Content-Range": `0-0/${existing}` } });
    });
    const supabase = createSupabaseAdmin(
      { NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" },
      fetchFn,
    );
    return { supabase, calls };
  }

  it("prunes after a normal-sized import", async () => {
    const { supabase, calls } = supabaseWith(1000);
    expect(await prunePlaces(supabase, "Jeddah", "overture", "2026-11-18.0", 990)).toEqual({ removed: 12, skipped: null });
    expect(calls.some((c) => c.endsWith("/rpc/prune_places"))).toBe(true);
  });

  it("refuses to prune after a suspiciously small import", async () => {
    const { supabase, calls } = supabaseWith(1000);
    const result = await prunePlaces(supabase, "Jeddah", "overture", "2026-11-18.0", 100);
    expect(result.removed).toBe(0);
    expect(result.skipped).toMatch(/not pruning/);
    expect(calls.some((c) => c.endsWith("/rpc/prune_places"))).toBe(false);
  });
});
