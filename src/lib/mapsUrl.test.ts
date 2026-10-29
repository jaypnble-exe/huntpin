import { describe, expect, it } from "vitest";
import { googleMapsPlaceUrl } from "./mapsUrl";

describe("googleMapsPlaceUrl", () => {
  it("builds a Maps URLs search link with the place ID", () => {
    const url = new URL(googleMapsPlaceUrl("ChIJ123", "cafés in Jeddah"));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query_place_id")).toBe("ChIJ123");
    expect(url.searchParams.get("query")).toBe("cafés in Jeddah");
  });

  it("encodes unsafe characters", () => {
    const url = googleMapsPlaceUrl("id&x=1", "a b#c");
    expect(url).not.toContain("#");
    expect(new URL(url).searchParams.get("query_place_id")).toBe("id&x=1");
  });
});
