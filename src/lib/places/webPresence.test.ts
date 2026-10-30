import { describe, expect, it } from "vitest";
import { classifyWebPresence, hasInstagram, isSocialUrl } from "./webPresence";

const NONE = { websites: [], socials: [], operatingStatus: null };

describe("isSocialUrl", () => {
  it.each([
    "https://www.instagram.com/shop",
    "http://m.facebook.com/page",
    "linktr.ee/brand",
    "https://wa.me/966500000000",
    "https://api.whatsapp.com/send?phone=1",
    "https://x.com/brand",
    "https://www.tiktok.com/@brand",
  ])("treats %s as social", (url) => {
    expect(isSocialUrl(url)).toBe(true);
  });

  it.each([
    "https://example.com",
    "https://notinstagram.com",
    "https://instagram.com.evil.example",
    "https://box.com",
    "not a url",
  ])("does not treat %s as social", (url) => {
    expect(isSocialUrl(url)).toBe(false);
  });
});

describe("classifyWebPresence", () => {
  it("is website_listed when any non-social website exists", () => {
    expect(
      classifyWebPresence({ ...NONE, websites: ["https://instagram.com/a", "https://cafe.sa"] }),
    ).toBe("website_listed");
  });

  it("is social_only when the only 'websites' are social links", () => {
    expect(classifyWebPresence({ ...NONE, websites: ["https://linktr.ee/a"] })).toBe("social_only");
  });

  it("is social_only when there are socials but no website", () => {
    expect(classifyWebPresence({ ...NONE, socials: ["https://facebook.com/1"] })).toBe("social_only");
  });

  it("is no_website_listed when nothing is listed", () => {
    expect(classifyWebPresence(NONE)).toBe("no_website_listed");
  });

  it("flags non-open operating status before anything else", () => {
    expect(
      classifyWebPresence({ websites: ["https://cafe.sa"], socials: [], operatingStatus: "permanently_closed" }),
    ).toBe("possibly_closed");
    expect(classifyWebPresence({ ...NONE, operatingStatus: "open" })).toBe("no_website_listed");
  });
});

describe("hasInstagram", () => {
  it("finds Instagram in websites or socials", () => {
    expect(hasInstagram({ websites: ["https://instagram.com/a"], socials: [] })).toBe(true);
    expect(hasInstagram({ websites: [], socials: ["https://www.instagram.com/b"] })).toBe(true);
    expect(hasInstagram({ websites: ["https://cafe.sa"], socials: ["https://facebook.com/1"] })).toBe(false);
  });
});
