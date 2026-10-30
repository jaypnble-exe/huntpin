import { describe, expect, it } from "vitest";
import { chainKeys, computeChainSizes, parseTargetGroups, reviewBonus, scoreParts, scorePlace } from "./leadScore";

const BASE = {
  webPresence: "no_website_listed" as const,
  hasInstagram: true,
  phoneCount: 1,
  category: "cafe",
  confidence: 0.95,
  chainSize: 1,
};

describe("scorePlace", () => {
  it("gives the best independent leads the top score", () => {
    expect(scorePlace(BASE)).toBe(90);
    expect(scoreParts(BASE).map((p) => p.label)).toEqual([
      "No website listed",
      "Phone number listed",
      "Active on Instagram",
      "Target category",
      "Likely still exists (95%)",
    ]);
  });

  it("ranks social-only above website-listed", () => {
    const social = scorePlace({ ...BASE, webPresence: "social_only" });
    const website = scorePlace({ ...BASE, webPresence: "website_listed" });
    expect(social).toBeGreaterThan(website);
    expect(website).toBeGreaterThan(0);
  });

  it("drops chains and closed places to the bottom", () => {
    expect(scorePlace({ ...BASE, chainSize: 3 })).toBe(5);
    expect(scorePlace({ ...BASE, webPresence: "possibly_closed" })).toBe(0);
  });

  it("scores confidence and non-target categories", () => {
    expect(scorePlace({ ...BASE, confidence: 0.3 })).toBe(75);
    expect(scorePlace({ ...BASE, confidence: null })).toBe(80);
    expect(scorePlace({ ...BASE, category: "bank_or_credit_union" })).toBe(75);
    expect(scorePlace({ ...BASE, category: "bank_or_credit_union" }, ["services"])).toBe(75);
    expect(scorePlace({ ...BASE, category: "hotel" }, ["hotels"])).toBe(90);
  });

  it("caps the review bonus", () => {
    expect(reviewBonus(0)).toBe(0);
    expect(reviewBonus(2)).toBe(6);
    expect(reviewBonus(9)).toBe(10);
  });
});

describe("parseTargetGroups", () => {
  it("defaults and validates", () => {
    expect(parseTargetGroups(undefined)).toEqual(["food", "beauty", "health", "retail"]);
    expect(parseTargetGroups("food, hotels")).toEqual(["food", "hotels"]);
    expect(() => parseTargetGroups("food,weapons")).toThrow(/weapons/);
  });
});

describe("chain detection", () => {
  it("groups bilingual and differently punctuated names", () => {
    expect(chainKeys("بيتزا هت | Pizza Hut")).toEqual(["بيتزا هت pizza hut", "pizza hut", "بيتزا هت"]);
    const sizes = computeChainSizes(["Pizza Hut", "PIZZA-HUT", "بيتزا هت | Pizza Hut", "Basic Cafe", null, "Al"]);
    expect(sizes).toEqual([3, 3, 3, 1, 1, 1]);
  });

  it("normalizes Arabic letter variants", () => {
    const sizes = computeChainSizes(["إيوان", "ايوان", "أيوان"]);
    expect(sizes).toEqual([3, 3, 3]);
  });
});
