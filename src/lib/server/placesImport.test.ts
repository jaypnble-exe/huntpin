import { describe, expect, it, vi } from "vitest";
import { validateBBox } from "../places/areas";
import {
  overturePlacesQuery,
  summarize,
  toPlaceRow,
  upsertPlaces,
  type OverturePlace,
  type PlaceRow,
} from "./placesImport";
import { createSupabaseAdmin } from "./supabase";

const META = { release: "2026-10-21.0", area: "Jeddah" };

const RAW: OverturePlace = {
  id: "08f-test",
  name: " Café One ",
  basic_category: "cafe",
  taxonomy_primary: "cafe",
  websites: ["https://www.instagram.com/cafeone"],
  socials: ["https://www.facebook.com/1", "https://www.facebook.com/1"],
  phones: ["+966 12 000 0000"],
  confidence: 0.8,
  operating_status: null,
  lon: 39.15,
  lat: 21.58,
  source_datasets: ["meta"],
  source_licenses: ["CDLA-Permissive-2.0"],
};

describe("toPlaceRow", () => {
  it("maps and classifies an Overture record", () => {
    expect(toPlaceRow(RAW, META)).toEqual({
      id: "08f-test",
      source: "overture",
      source_release: "2026-10-21.0",
      area: "Jeddah",
      name: "Café One",
      basic_category: "cafe",
      taxonomy_primary: "cafe",
      websites: ["https://www.instagram.com/cafeone"],
      socials: ["https://www.facebook.com/1"],
      phones: ["+966 12 000 0000"],
      web_presence: "social_only",
      has_instagram: true,
      confidence: 0.8,
      operating_status: null,
      lat: 21.58,
      lon: 39.15,
      source_datasets: ["meta"],
      source_licenses: ["CDLA-Permissive-2.0"],
    });
  });

  it("handles null lists", () => {
    const row = toPlaceRow({ ...RAW, websites: null, socials: null, phones: null }, META);
    expect(row).toMatchObject({ websites: [], socials: [], phones: [], web_presence: "no_website_listed" });
  });

  it("rejects records without an ID or with bad coordinates", () => {
    expect(toPlaceRow({ ...RAW, id: null }, META)).toBeNull();
    expect(toPlaceRow({ ...RAW, lat: "abc" }, META)).toBeNull();
    expect(toPlaceRow({ ...RAW, lon: 200 }, META)).toBeNull();
  });

  it("drops out-of-range confidence", () => {
    expect(toPlaceRow({ ...RAW, confidence: 3 }, META)?.confidence).toBeNull();
  });
});

describe("overturePlacesQuery", () => {
  it("filters on the bbox and release", () => {
    const sql = overturePlacesQuery("2026-10-21.0", [39.05, 21.25, 39.35, 21.85]);
    expect(sql).toContain("release/2026-10-21.0/theme=places/type=place/*");
    expect(sql).toContain("bbox.xmin BETWEEN 39.05 AND 39.35");
    expect(sql).toContain("bbox.ymin BETWEEN 21.25 AND 21.85");
  });

  it("rejects unsafe input", () => {
    expect(() => overturePlacesQuery("x'; DROP", [0, 0, 1, 1])).toThrow();
    expect(() => overturePlacesQuery("2026-10-21.0", [0, 0, NaN, 1])).toThrow();
  });
});

describe("validateBBox", () => {
  it("accepts Jeddah and rejects bad boxes", () => {
    expect(validateBBox([39.05, 21.25, 39.35, 21.85])).toBeNull();
    expect(validateBBox([1, 2, 3])).not.toBeNull();
    expect(validateBBox([39.35, 21.25, 39.05, 21.85])).not.toBeNull();
    expect(validateBBox([30, 20, 40, 21])).toMatch(/at most/);
    expect(validateBBox([-200, 0, -199.5, 0.5])).toMatch(/range/);
  });
});

describe("summarize", () => {
  it("counts by web presence and Instagram", () => {
    const rows = [toPlaceRow(RAW, META), toPlaceRow({ ...RAW, id: "b", websites: ["https://cafe.sa"] }, META)] as PlaceRow[];
    expect(summarize(rows)).toEqual({
      total: 2,
      byPresence: { social_only: 1, website_listed: 1 },
      withInstagram: 1,
      licenses: ["CDLA-Permissive-2.0"],
    });
  });
});

describe("upsertPlaces", () => {
  it("upserts in batches of 500 with onConflict=id and stops on error", async () => {
    let calls = 0;
    const fetchFn = vi.fn<typeof fetch>(async (input) => {
      calls += 1;
      expect(new URL(String(input)).searchParams.get("on_conflict")).toBe("id");
      return calls === 3
        ? new Response(JSON.stringify({ message: "boom" }), { status: 500 })
        : new Response(null, { status: 201 });
    });
    const supabase = createSupabaseAdmin(
      { NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" },
      fetchFn,
    );
    const rows = Array.from({ length: 1200 }, (_, i) => toPlaceRow({ ...RAW, id: `p${i}` }, META)) as PlaceRow[];
    const progress: number[] = [];

    await expect(upsertPlaces(supabase, rows, (done) => progress.push(done))).rejects.toThrow(/row 1000/);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(progress).toEqual([500, 1000]);
    expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toHaveLength(500);
  });
});
