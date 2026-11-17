import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { gmailConfig } from "./config";
import { decryptSecret, encryptSecret } from "./crypto";
import { authorizationUrl, codeChallenge, GMAIL_SCOPE } from "./oauth";
import { outreachBcc } from "./store";

const key = randomBytes(32);
const env = {
  GMAIL_CLIENT_ID: "123-abc.apps.googleusercontent.com",
  GMAIL_CLIENT_SECRET: "secret",
  GMAIL_TOKEN_KEY: key.toString("base64"),
};

describe("gmailConfig", () => {
  it("is off without settings and on with all three", () => {
    expect(gmailConfig({}).kind).toBe("off");
    expect(gmailConfig(env).kind).toBe("on");
  });

  it("fails closed on partial or malformed settings", () => {
    expect(gmailConfig({ GMAIL_CLIENT_ID: env.GMAIL_CLIENT_ID }).kind).toBe("misconfigured");
    expect(gmailConfig({ ...env, GMAIL_TOKEN_KEY: "c2hvcnQ=" }).kind).toBe("misconfigured");
    expect(gmailConfig({ ...env, GMAIL_CLIENT_ID: "not-a-client-id" }).kind).toBe("misconfigured");
  });
});

describe("token encryption", () => {
  it("round-trips and never contains the plain token", () => {
    const sealed = encryptSecret("1//refresh-token", key);
    expect(sealed).not.toContain("refresh-token");
    expect(decryptSecret(sealed, key)).toBe("1//refresh-token");
    expect(encryptSecret("1//refresh-token", key)).not.toBe(sealed);
  });

  it("rejects a tampered value or the wrong key", () => {
    const sealed = encryptSecret("token", key);
    const parts = sealed.split(".");
    parts[3] = Buffer.from("other").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() => decryptSecret(sealed, randomBytes(32))).toThrow();
    expect(() => decryptSecret("garbage", key)).toThrow();
  });
});

describe("authorizationUrl", () => {
  it("asks only for gmail.modify, offline, with PKCE", () => {
    const url = new URL(
      authorizationUrl({ clientId: env.GMAIL_CLIENT_ID, redirectUri: "https://huntpin.vercel.app/api/gmail/callback", state: "s", verifier: "v" }),
    );
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(GMAIL_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("code_challenge")).toBe(codeChallenge("v"));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("s");
  });
});

describe("outreachBcc", () => {
  it("prefers OUTREACH_BCC, else the Gmail address with +huntpin", () => {
    expect(outreachBcc("me@gmail.com", { OUTREACH_BCC: "Other+X@gmail.com" })).toBe("other+x@gmail.com");
    expect(outreachBcc("me@gmail.com", {})).toBe("me+huntpin@gmail.com");
    expect(outreachBcc(null, {})).toBeNull();
    expect(outreachBcc(null, { OUTREACH_BCC: "not an email" })).toBeNull();
  });
});
