import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, parsePlaceQuery, toSearchParams } from "./filters";
import { googleMapsCoordinatesUrl, safeHref, telHref } from "./links";

const JEDDAH_VIEW = [39.13, 21.57, 39.17, 21.6] as [number, number, number, number];

describe("place filters", () => {
  it("round-trips through the query string", () => {
    const filters = {
      presence: ["social_only" as const],
      minConfidence: 0.7,
      category: "food" as const,
      instagramOnly: true,
      nameQuery: "قهوة",
    };
    const parsed = parsePlaceQuery(toSearchParams(JEDDAH_VIEW, filters));
    expect(parsed).toEqual({ ok: true, bbox: JEDDAH_VIEW, filters });
  });

  it("uses the default presence when none is given", () => {
    const parsed = parsePlaceQuery(new URLSearchParams({ bbox: JEDDAH_VIEW.join(",") }));
    expect(parsed.ok && parsed.filters.presence).toEqual(DEFAULT_FILTERS.presence);
  });

  it.each([
    [{ bbox: "1,2,3" }, /bbox/],
    [{ bbox: "30,20,40,21" }, /at most/],
    [{ bbox: JEDDAH_VIEW.join(","), presence: "" }, /presence/],
    [{ bbox: JEDDAH_VIEW.join(","), presence: "social_only,hacked" }, /presence/],
    [{ bbox: JEDDAH_VIEW.join(","), minConfidence: "2" }, /minConfidence/],
    [{ bbox: JEDDAH_VIEW.join(","), category: "weapons" }, /category/],
    [{ bbox: JEDDAH_VIEW.join(","), q: "x".repeat(61) }, /q must/],
    [{ bbox: JEDDAH_VIEW.join(","), q: "a\u0000b" }, /q must/],
  ])("rejects %o", (params, error) => {
    const parsed = parsePlaceQuery(new URLSearchParams(params));
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error).toMatch(error);
  });
});

describe("links", () => {
  it("only makes http(s) links clickable", () => {
    expect(safeHref("https://cafe.sa/menu")).toBe("https://cafe.sa/menu");
    expect(safeHref("cafe.sa")).toBe("https://cafe.sa/");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,hi")).toBeNull();
    expect(safeHref("  ")).toBeNull();
  });

  it("builds tel links from listed numbers", () => {
    expect(telHref("+966 12 345 6789")).toBe("tel:+966123456789");
    expect(telHref("call us")).toBeNull();
  });

  it("builds a Google Maps coordinates link", () => {
    const url = new URL(googleMapsCoordinatesUrl(21.58, 39.15));
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("21.58,39.15");
  });
});
