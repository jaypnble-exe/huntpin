import { describe, expect, it } from "vitest";
import { mailtoHref, normalizeEmails } from "./emails";

describe("normalizeEmails", () => {
  it("cleans, lowercases and de-duplicates", () => {
    expect(normalizeEmails([" Info@Cafe.SA ", "info@cafe.sa", "mailto:owner@gmail.com"])).toEqual([
      "info@cafe.sa",
      "owner@gmail.com",
    ]);
  });

  it("accepts a single value or nothing", () => {
    expect(normalizeEmails("hello@shop.sa")).toEqual(["hello@shop.sa"]);
    expect(normalizeEmails(null)).toEqual([]);
    expect(normalizeEmails(undefined)).toEqual([]);
  });

  it("drops invalid or unsafe values", () => {
    expect(
      normalizeEmails(["not an email", "a@b", "x@-bad.com", "a,b@c.com", "<a@b.com>", 42, "a@b.com\nBcc: c@d.com"]),
    ).toEqual([]);
  });

  it("keeps at most five", () => {
    expect(normalizeEmails(Array.from({ length: 8 }, (_, i) => `u${i}@shop.sa`))).toHaveLength(5);
  });
});

describe("mailtoHref", () => {
  it("builds a mailto link with subject and body, spaces as %20", () => {
    const href = mailtoHref("Info@Cafe.sa", { subject: "Hi there", body: "Line 1\n\nمرحباً 👋" })!;
    expect(href.startsWith("mailto:info@cafe.sa?")).toBe(true);
    expect(href).not.toContain("+");
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("subject")).toBe("Hi there");
    expect(params.get("body")).toBe("Line 1\n\nمرحباً 👋");
  });

  it("refuses invalid addresses (no header injection)", () => {
    expect(mailtoHref("a@b.com?bcc=x@y.com")).toBeNull();
    expect(mailtoHref("nope")).toBeNull();
  });
});
