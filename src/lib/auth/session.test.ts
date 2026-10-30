import { describe, expect, it } from "vitest";
import { authConfig, createSessionToken, parseAllowedHosts, safeNextPath, SESSION_TTL_MS, verifySessionToken } from "./session";
import { hashPassword, verifyPassword } from "../server/password";

const SECRET = "a".repeat(40);

describe("session tokens", () => {
  it("verifies its own tokens until they expire", async () => {
    const now = Date.UTC(2026, 9, 30);
    const token = await createSessionToken(SECRET, now);
    expect(await verifySessionToken(token, SECRET, now + 1000)).toBe(true);
    expect(await verifySessionToken(token, SECRET, now + SESSION_TTL_MS + 1)).toBe(false);
    expect(await verifySessionToken(token, "b".repeat(40), now)).toBe(false);
  });

  it("rejects tampered or malformed tokens", async () => {
    const token = await createSessionToken(SECRET);
    const [v, , nonce, sig] = token.split(".");
    expect(await verifySessionToken(`${v}.${Date.now() + 10 * SESSION_TTL_MS}.${nonce}.${sig}`, SECRET)).toBe(false);
    for (const bad of [undefined, "", "v1.1.2", "v1.x.y.z", `${token}x!`, "x".repeat(300)]) {
      expect(await verifySessionToken(bad, SECRET)).toBe(false);
    }
  });
});

describe("authConfig", () => {
  it("is off, on, or misconfigured (fail closed)", () => {
    expect(authConfig({})).toEqual({ kind: "off" });
    expect(authConfig({ APP_PASSWORD_HASH: "scrypt:x", SESSION_SECRET: SECRET, APP_ALLOWED_HOSTS: "192.168.1.20:3000, Lead.Example" })).toMatchObject({
      kind: "on",
      allowedHosts: new Set(["192.168.1.20", "lead.example"]),
    });
    expect(authConfig({ SESSION_SECRET: SECRET }).kind).toBe("misconfigured");
    expect(authConfig({ APP_PASSWORD_HASH: "scrypt:x", SESSION_SECRET: "short" }).kind).toBe("misconfigured");
    expect(authConfig({ APP_PASSWORD_HASH: "plaintext", SESSION_SECRET: SECRET }).kind).toBe("misconfigured");
  });

  it("parses hosts and keeps IPv6 brackets", () => {
    expect(parseAllowedHosts(" [fe80::1]:3000 ,,a.b ")).toEqual(new Set(["[fe80::1]", "a.b"]));
  });
});

describe("safeNextPath", () => {
  it("only returns same-site paths", () => {
    expect(safeNextPath("/leads?lead=1")).toBe("/leads?lead=1");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", null, ""]) expect(safeNextPath(bad)).toBe("/");
  });
});

describe("password hashing", () => {
  it("verifies the right password only", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^scrypt:16384:8:1:[\w-]+:[\w-]+$/);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong password!!", hash)).toBe(false);
    expect(await verifyPassword("correct horse battery", "scrypt:99999999:8:1:a:b")).toBe(false);
    await expect(hashPassword("short")).rejects.toThrow();
  });
});
