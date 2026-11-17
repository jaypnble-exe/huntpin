import { describe, expect, it } from "vitest";
import { buildRawMessage, encodeHeaderValue } from "./mime";
import { fromAddress, threadStatus } from "./replies";

function decode(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

describe("buildRawMessage", () => {
  it("builds a plain-text UTF-8 email with a BCC", () => {
    const text = decode(
      buildRawMessage({ to: "Info@Cafe.sa", bcc: "me+huntpin@gmail.com", subject: "Website & App Development Proposal", body: "Hi!\nمرحباً 👋" }),
    );
    const [head, body] = text.split("\r\n\r\n");
    expect(head).toContain("To: info@cafe.sa");
    expect(head).toContain("Bcc: me+huntpin@gmail.com");
    expect(head).toContain("Subject: Website & App Development Proposal");
    expect(Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8")).toBe("Hi!\r\nمرحباً 👋");
  });

  it("never lets a subject or address add headers", () => {
    const text = decode(buildRawMessage({ to: "a@b.sa", subject: "Hi\r\nBcc: evil@x.com", body: "x" }));
    expect(text.split("\r\n\r\n")[0]).not.toMatch(/^Bcc:/m);
    expect(() => buildRawMessage({ to: "a@b.sa\r\nBcc: evil@x.com", subject: "s", body: "b" })).toThrow();
  });

  it("encodes non-ASCII subjects as short UTF-8 words", () => {
    const encoded = encodeHeaderValue("عرض تطوير المواقع والتطبيقات");
    expect(encoded.startsWith("=?UTF-8?B?")).toBe(true);
    const words = encoded.split("\r\n ");
    expect(words.every((w) => w.length <= 75)).toBe(true);
    const decoded = words.map((w) => Buffer.from(w.slice(10, -2), "base64").toString("utf8")).join("");
    expect(decoded).toBe("عرض تطوير المواقع والتطبيقات");
  });
});

describe("threadStatus", () => {
  const own = "me@gmail.com";
  const msg = (labels: string[], from: string, auto?: string) => ({
    labelIds: labels,
    payload: { headers: [{ name: "From", value: from }, ...(auto ? [{ name: "Auto-Submitted", value: auto }] : [])] },
  });

  it("counts a reply only after the operator sent the message", () => {
    expect(threadStatus([msg(["DRAFT"], own)], own)).toEqual({ sent: false, replied: false });
    expect(threadStatus([msg(["SENT"], own)], own)).toEqual({ sent: true, replied: false });
    expect(threadStatus([msg(["SENT"], own), msg(["INBOX"], "Cafe <info@cafe.sa>")], own)).toEqual({ sent: true, replied: true });
  });

  it("ignores the BCC copy, bounces and automatic replies", () => {
    const sent = msg(["SENT"], own);
    expect(threadStatus([sent, msg(["INBOX"], "Me <me+huntpin@gmail.com>")], own).replied).toBe(false);
    expect(threadStatus([sent, msg(["INBOX"], "Mail Delivery Subsystem <mailer-daemon@googlemail.com>")], own).replied).toBe(false);
    expect(threadStatus([sent, msg(["INBOX"], "info@cafe.sa", "auto-replied")], own).replied).toBe(false);
  });

  it("reads addresses from From headers", () => {
    expect(fromAddress('"Café" <Info+x@Cafe.sa>')).toBe("info@cafe.sa");
    expect(fromAddress("info@cafe.sa")).toBe("info@cafe.sa");
    expect(fromAddress("nobody")).toBeNull();
  });
});
