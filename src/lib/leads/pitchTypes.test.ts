import { describe, expect, it } from "vitest";
import { autoPitch, buildDraft, DEFAULT_TEMPLATES, isPitchChoice, mergeTemplates, parseTemplates, pitchLabel } from "./outreach";
import { PITCH_TYPE_KEYS, PITCH_TYPES, pitchTypeOf } from "./pitchTypes";

describe("pitch types", () => {
  it("maps categories to finer business types", () => {
    expect(pitchTypeOf("coffee_shop")).toBe("cafe");
    expect(pitchTypeOf("restaurant")).toBe("restaurant");
    expect(pitchTypeOf("gym")).toBe("gym");
    expect(pitchTypeOf("personal_or_beauty_service")).toBe("salon");
    expect(pitchTypeOf("hardware_home_and_garden_store")).toBe("building");
    expect(pitchTypeOf("arts_and_entertainment")).toBe("entertainment");
    expect(pitchTypeOf("muslim_place_of_worship")).toBeNull();
    expect(pitchTypeOf(null)).toBeNull();
  });

  it("puts each category in one type only", () => {
    const all = PITCH_TYPE_KEYS.flatMap((key) => [...PITCH_TYPES[key].categories]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("has a default pitch for every type in both languages, with no claims about the business", () => {
    for (const lang of ["en", "ar"] as const) {
      for (const key of PITCH_TYPE_KEYS) {
        const text = DEFAULT_TEMPLATES[lang].typePitches[key];
        expect(text.length).toBeGreaterThan(30);
        expect(text).not.toMatch(/you (don’t|don't|do not) have|no website/i);
      }
    }
  });
});

describe("choosing the pitch", () => {
  const en = DEFAULT_TEMPLATES.en;

  it("prefers the type, then the group, then the general question", () => {
    expect(autoPitch(en, "gym", "beauty")).toBe("type:gym");
    expect(autoPitch({ ...en, typePitches: { ...en.typePitches, gym: "  " } }, "gym", "beauty")).toBe("group:beauty");
    expect(autoPitch(en, null, null)).toBe("general");
    expect(pitchLabel("type:gym")).toBe("Gyms & fitness");
  });

  it("uses the type's pitch, and the operator's override", () => {
    const gym = buildDraft({ language: "en", name: "PT Gym", sentences: [], pitchType: "gym", category: "beauty" }).split("\n\n");
    expect(gym[2]).toBe(en.typePitches.gym);

    const overridden = buildDraft({ language: "ar", name: null, sentences: [], pitchType: "gym", pitch: "type:restaurant" }).split("\n\n");
    expect(overridden[2]).toBe(DEFAULT_TEMPLATES.ar.typePitches.restaurant);

    const general = buildDraft({ language: "en", name: null, sentences: [], pitchType: "gym", pitch: "general" }).split("\n\n");
    expect(general[2]).toBe(en.first.question);
  });

  it("validates pitch choices", () => {
    expect(isPitchChoice("type:cafe")).toBe(true);
    expect(isPitchChoice("group:food")).toBe(true);
    expect(isPitchChoice("type:toString")).toBe(false);
    expect(isPitchChoice("auto")).toBe(false);
  });
});

describe("saved templates", () => {
  it("fills in type pitches for templates saved before they existed", () => {
    const { typePitches: _omit, ...oldEn } = DEFAULT_TEMPLATES.en;
    const merged = mergeTemplates({ en: { ...oldEn, first: { ...oldEn.first, intro: "My intro" } } });
    expect(merged.en.first.intro).toBe("My intro");
    expect(merged.en.typePitches.cafe).toBe(DEFAULT_TEMPLATES.en.typePitches.cafe);
  });

  it("accepts the full set and rejects unknown types", () => {
    expect(parseTemplates(DEFAULT_TEMPLATES).ok).toBe(true);
    const bad = { ...DEFAULT_TEMPLATES, en: { ...DEFAULT_TEMPLATES.en, typePitches: { ...DEFAULT_TEMPLATES.en.typePitches, casino: "x" } } };
    expect(parseTemplates(bad)).toEqual({ ok: false, error: "templates.en.typePitches.casino is not a template field" });
  });
});
