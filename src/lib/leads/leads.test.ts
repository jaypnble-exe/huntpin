import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";
import { canDraftOutreach, parseLeadPatch } from "./leads";
import {
  buildDraft,
  DEFAULT_OUTREACH_MESSAGE,
  DEFAULT_TEMPLATES,
  FOLLOW_UP_TEMPLATES,
  defaultLanguage,
  mergeTemplates,
  namePart,
  OUTREACH_TEMPLATES,
  parseTemplates,
  whatsappHref,
} from "./outreach";

describe("parseLeadPatch", () => {
  it("accepts deal stages and a deal value, rounded to halalas", () => {
    expect(parseLeadPatch({ status: "proposal_sent", dealValue: 4500.555 })).toEqual({
      ok: true,
      patch: { lead_status: "proposal_sent", deal_value: 4500.56 },
      markContacted: false,
    });
    expect(parseLeadPatch({ dealValue: null })).toMatchObject({ ok: true, patch: { deal_value: null } });
    for (const bad of [-1, 10_000_000, Number.NaN, "5000", Infinity]) {
      expect(parseLeadPatch({ dealValue: bad }).ok).toBe(false);
    }
    expect(canDraftOutreach("won")).toBe(false);
    expect(canDraftOutreach("meeting")).toBe(true);
  });

  it("maps browser fields to columns", () => {
    expect(
      parseLeadPatch({
        label: "  Basic Cafe ",
        notes: "Owner prefers WhatsApp",
        status: "reviewed",
        firstContactedOn: "2026-10-29",
        lastContactedOn: null,
      }),
    ).toEqual({
      ok: true,
      markContacted: false,
      patch: {
        label: "Basic Cafe",
        operator_notes: "Owner prefers WhatsApp",
        lead_status: "reviewed",
        first_contacted_at: "2026-10-29T00:00:00.000Z",
        last_contacted_at: null,
      },
    });
  });

  it("treats blank text as null", () => {
    expect(parseLeadPatch({ notes: "   " })).toEqual({ ok: true, markContacted: false, patch: { operator_notes: null } });
  });

  it("accepts confirmed opportunity keys, deduplicated", () => {
    expect(parseLeadPatch({ confirmedOpportunities: ["no_https", "no_arabic", "no_https"] })).toEqual({
      ok: true,
      markContacted: false,
      patch: { confirmed_opportunities: ["no_https", "no_arabic"] },
    });
  });

  it("accepts a manual follow-up date or null", () => {
    expect(parseLeadPatch({ followUpOn: "2026-11-05" })).toEqual({ ok: true, markContacted: false, patch: { follow_up_on: "2026-11-05" } });
    expect(parseLeadPatch({ followUpOn: null })).toEqual({ ok: true, markContacted: false, patch: { follow_up_on: null } });
  });

  it("accepts markContacted on its own", () => {
    expect(parseLeadPatch({ markContacted: true })).toEqual({ ok: true, markContacted: true, patch: {} });
  });

  it.each([
    [null, /object/],
    [{}, /Nothing/],
    [{ status: "spam" }, /status/],
    [{ lead_status: "new" }, /unsupported/],
    [{ label: "x".repeat(121) }, /label/],
    [{ notes: 5 }, /notes/],
    [{ notes: "a\u0000b" }, /invalid/],
    [{ firstContactedOn: "2026-02-30" }, /real date/],
    [{ lastContactedOn: "yesterday" }, /YYYY-MM-DD/],
    [{ markContacted: "yes" }, /boolean/],
    [{ followUpOn: "next week" }, /followUpOn/],
    [{ followUpOn: "2026-02-30" }, /followUpOn/],
    [{ confirmedOpportunities: "no_https" }, /confirmedOpportunities/],
    [{ confirmedOpportunities: ["DROP TABLE"] }, /confirmedOpportunities/],
    [{ confirmedOpportunities: Array.from({ length: 21 }, (_, i) => "k" + "x".repeat(i)) }, /confirmedOpportunities/],
  ])("rejects %o", (body, error) => {
    const result = parseLeadPatch(body);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(error);
  });

  it("keeps newlines in notes", () => {
    const result = parseLeadPatch({ notes: "line 1\nline 2" });
    expect(result.ok && result.patch.operator_notes).toBe("line 1\nline 2");
  });
});

describe("outreach", () => {
  it("never offers drafts for declined or opted-out leads", () => {
    expect(canDraftOutreach("new")).toBe(true);
    expect(canDraftOutreach("follow_up")).toBe(true);
    expect(canDraftOutreach("not_interested")).toBe(false);
    expect(canDraftOutreach("do_not_contact")).toBe(false);
  });

  it("uses the default message from CLAUDE.md, without claiming a source", () => {
    expect(DEFAULT_OUTREACH_MESSAGE.startsWith("Hi! 👋 I came across your business online")).toBe(true);
    expect(DEFAULT_OUTREACH_MESSAGE.endsWith("Would you be open to a quick chat? 😊")).toBe(true);
    for (const template of Object.values(OUTREACH_TEMPLATES)) {
      expect(template.text).not.toMatch(/Google/i);
    }
  });

  it("builds a WhatsApp link for one number", () => {
    const href = whatsappHref("+966 55 441 1817", "Hi & bye");
    expect(href).toBe("https://api.whatsapp.com/send?phone=966554411817&text=Hi%20%26%20bye");
    expect(whatsappHref("123", "x")).toBeNull();
  });

  it("keeps emojis, Arabic and line breaks intact in the WhatsApp link", () => {
    const message = "Hi! 👋\n\nمرحباً 😊 a+b";
    const href = whatsappHref("966554411817", message)!;
    expect(href).toContain("%F0%9F%91%8B"); // 👋 as UTF-8
    expect(href).not.toContain("+");
    expect(new URL(href).searchParams.get("text")).toBe(message);
  });
});

describe("personalised drafts", () => {
  it("picks the name part that matches the language", () => {
    expect(namePart("Basic Cafe بيسك كافيه", "en")).toBe("Basic Cafe");
    expect(namePart("Basic Cafe بيسك كافيه", "ar")).toBe("بيسك كافيه");
    expect(namePart("Dr. Shereen Ismail Buheis الدكتورة شيرين", "en")).toBe("Dr. Shereen Ismail Buheis");
    expect(namePart("سرايا عابدين", "en")).toBe("سرايا عابدين");
    expect(namePart("  ", "en")).toBeNull();
  });

  it("defaults to Arabic only for Arabic-only names", () => {
    expect(defaultLanguage("سرايا عابدين")).toBe("ar");
    expect(defaultLanguage("Basic Cafe بيسك كافيه")).toBe("en");
    expect(defaultLanguage(null)).toBe("en");
  });

  it("personalises the greeting and inserts confirmed observations after the intro", () => {
    const draft = buildDraft({
      language: "en",
      name: "Basic Cafe",
      sentences: ["I noticed your website doesn’t seem to have an Arabic version."],
    });
    const paragraphs = draft.split("\n\n");
    expect(paragraphs[0]).toBe("Hi Basic Cafe team! 👋 I came across your business online and wanted to reach out.");
    expect(paragraphs[1]).toMatch(/^I’m a web and mobile app developer/);
    expect(paragraphs[2]).toBe(
      "I noticed your website doesn’t seem to have an Arabic version. I’d be happy to help with that.",
    );
    expect(paragraphs).toHaveLength(5);
  });

  it("builds a short personalised follow-up", () => {
    const draft = buildDraft({ language: "en", name: "Basic Cafe", sentences: [], kind: "follow_up" });
    expect(draft.split("\n\n")[0]).toBe("Hi Basic Cafe team! 👋 Just following up on my earlier message.");
    expect(draft).toMatch(/no problem at all, just let me know/);
    expect(buildDraft({ language: "ar", name: null, sentences: [], kind: "follow_up" })).toBe(FOLLOW_UP_TEMPLATES.ar);
  });

  it("adds the portfolio link or an offer just before the closing question", () => {
    const url = "https://pejay.is-a.dev";
    const linked = buildDraft({ language: "en", name: "Basic Cafe", sentences: [], kind: "follow_up", portfolio: { mode: "link", url } }).split("\n\n");
    expect(linked.at(-2)).toBe(`You can see some of my work here:
${url}`);
    expect(linked.at(-1)).toMatch(/^Would a quick chat/);

    const offered = buildDraft({ language: "ar", name: null, sentences: [], portfolio: { mode: "offer", url } }).split("\n\n");
    expect(offered.at(-2)).toBe("وإذا كان ذلك مفيداً، يسعدني مشاركة بعض نماذج أعمالي.");
    expect(offered.join(" ")).not.toContain(url);

    expect(buildDraft({ language: "en", name: null, sentences: [], portfolio: { mode: "none", url } })).toBe(OUTREACH_TEMPLATES.en.text);
    expect(buildDraft({ language: "en", name: null, sentences: [], portfolio: { mode: "link", url: null } })).toBe(OUTREACH_TEMPLATES.en.text);
  });

  it("keeps the template when there is nothing to personalise", () => {
    expect(buildDraft({ language: "ar", name: null, sentences: [] })).toBe(OUTREACH_TEMPLATES.ar.text);
    expect(buildDraft({ language: "ar", name: "سرايا عابدين", sentences: [] })).toMatch(/^مرحباً فريق سرايا عابدين! 👋/);
  });
});

describe("category pitches and edited templates", () => {
  it("replaces the general question with the category pitch in first messages only", () => {
    const first = buildDraft({ language: "en", name: "Basic Cafe", sentences: [], category: "food" }).split("\n\n");
    expect(first[2]).toBe(DEFAULT_TEMPLATES.en.pitches.food);
    expect(first).toHaveLength(4);
    expect(first.join(" ")).not.toContain("I was wondering");
    const followUp = buildDraft({ language: "en", name: "Basic Cafe", sentences: [], kind: "follow_up", category: "food" });
    expect(followUp).not.toContain(DEFAULT_TEMPLATES.en.pitches.food);
    expect(buildDraft({ language: "ar", name: null, sentences: [], category: "health" })).toContain("للعيادات");
  });

  it("falls back to the general question when a pitch is emptied, and drops empty paragraphs", () => {
    const templates = structuredClone(DEFAULT_TEMPLATES);
    templates.en.pitches.food = "  ";
    templates.en.first.intro = "";
    const draft = buildDraft({ language: "en", name: null, sentences: [], category: "food", templates }).split("\n\n");
    expect(draft).toEqual([templates.en.first.greeting, templates.en.first.question, templates.en.first.closing]);
  });

  it("inserts the name literally, even with special characters", () => {
    expect(buildDraft({ language: "en", name: "A$&B", sentences: [] }).split("\n\n")[0]).toMatch(/^Hi A\$&B team!/);
  });

  it("validates edited templates strictly", () => {
    expect(parseTemplates(structuredClone(DEFAULT_TEMPLATES))).toMatchObject({ ok: true });
    const missingName = structuredClone(DEFAULT_TEMPLATES);
    missingName.ar.first.greetingNamed = "مرحباً!";
    expect(parseTemplates(missingName)).toMatchObject({ ok: false, error: expect.stringContaining("{name}") });
    const tooLong = structuredClone(DEFAULT_TEMPLATES);
    tooLong.en.pitches.retail = "x".repeat(1001);
    expect(parseTemplates(tooLong).ok).toBe(false);
    expect(parseTemplates({ ...structuredClone(DEFAULT_TEMPLATES), fr: {} }).ok).toBe(false);
    expect(parseTemplates({ en: DEFAULT_TEMPLATES.en }).ok).toBe(false);
  });

  it("merges stored templates over the defaults field by field", () => {
    const merged = mergeTemplates({ en: { first: { closing: "Shall we talk?", greetingNamed: "no placeholder" }, pitches: { food: 5 } } });
    expect(merged.en.first.closing).toBe("Shall we talk?");
    expect(merged.en.first.greetingNamed).toBe(DEFAULT_TEMPLATES.en.first.greetingNamed);
    expect(merged.en.pitches.food).toBe(DEFAULT_TEMPLATES.en.pitches.food);
    expect(merged.ar).toEqual(DEFAULT_TEMPLATES.ar);
    expect(mergeTemplates("garbage")).toEqual(DEFAULT_TEMPLATES);
  });
});

describe("csv", () => {
  it("quotes and neutralizes formulas", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+966554411817")).toBe("'+966554411817");
    expect(csvCell(["a", "b"])).toBe("a | b");
    expect(csvCell(null)).toBe("");
  });

  it("adds a BOM and CRLF rows", () => {
    expect(toCsv(["name"], [["قهوة"]])).toBe("﻿name\r\nقهوة\r\n");
  });
});
