import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";
import { canDraftOutreach, parseLeadPatch } from "./leads";
import { DEFAULT_OUTREACH_MESSAGE, OUTREACH_TEMPLATES, whatsappHref } from "./outreach";

describe("parseLeadPatch", () => {
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
    expect(href).toBe("https://wa.me/966554411817?text=Hi%20%26%20bye");
    expect(whatsappHref("123", "x")).toBeNull();
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
