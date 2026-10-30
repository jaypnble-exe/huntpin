import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, SESSION_COOKIE } from "./lib/auth/session";
import { middleware } from "./middleware";

function request(method: string, headers: Record<string, string>, path = "/api/leads") {
  const host = headers.host ?? "localhost:3000";
  return new NextRequest(`http://${host}${path}`, { method, headers });
}

const LOCAL = { host: "localhost:3000" };
const status = async (req: NextRequest) => (await middleware(req)).status;

describe("middleware without login (localhost only)", () => {
  it("allows local reads and same-origin JSON writes", async () => {
    expect(await status(request("GET", LOCAL))).toBe(200);
    expect(await status(request("POST", { ...LOCAL, origin: "http://localhost:3000", "content-type": "application/json" }))).toBe(200);
    expect(await status(request("DELETE", LOCAL))).toBe(200);
  });

  it("blocks non-local hosts", async () => {
    expect(await status(request("GET", { host: "example.com" }))).toBe(403);
    expect(await status(request("GET", { ...LOCAL, "x-forwarded-host": "evil.example" }))).toBe(403);
    expect(await status(request("GET", { host: "192.168.1.20:3000" }))).toBe(403);
  });

  it("blocks cross-site writes", async () => {
    expect(await status(request("POST", { ...LOCAL, origin: "https://evil.example", "content-type": "application/json" }))).toBe(403);
    expect(await status(request("PATCH", { ...LOCAL, origin: "null" }))).toBe(403);
    expect(await status(request("DELETE", { ...LOCAL, "sec-fetch-site": "cross-site" }))).toBe(403);
  });

  it("blocks non-JSON write bodies (form or text/plain CSRF)", async () => {
    expect(await status(request("POST", { ...LOCAL, "content-type": "text/plain" }))).toBe(403);
    expect(await status(request("POST", { ...LOCAL, "content-type": "application/x-www-form-urlencoded" }))).toBe(403);
  });
});

describe("middleware with login", () => {
  const SECRET = "s".repeat(40);
  const PHONE_HOST = { host: "192.168.1.20:3000" };

  function enableLogin() {
    vi.stubEnv("APP_PASSWORD_HASH", "scrypt:16384:8:1:c2FsdA:aGFzaA");
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("APP_ALLOWED_HOSTS", "192.168.1.20");
  }
  afterEach(() => vi.unstubAllEnvs());

  it("requires a session for APIs and pages, on localhost too", async () => {
    enableLogin();
    expect(await status(request("GET", LOCAL))).toBe(401);
    const page = await middleware(request("GET", PHONE_HOST, "/leads?lead=1"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toBe("http://192.168.1.20:3000/login?next=%2Fleads%3Flead%3D1");
    expect(await status(request("GET", PHONE_HOST, "/login"))).toBe(200);
    expect(await status(request("POST", { ...PHONE_HOST, "content-type": "application/json" }, "/api/auth/login"))).toBe(200);
  });

  it("lets a valid session through on allowed hosts only", async () => {
    enableLogin();
    const cookie = `${SESSION_COOKIE}=${await createSessionToken(SECRET)}`;
    expect(await status(request("GET", { ...PHONE_HOST, cookie }))).toBe(200);
    expect(await status(request("GET", { ...LOCAL, cookie }))).toBe(200);
    expect(await status(request("GET", { host: "evil.example", cookie }))).toBe(403);
    const forged = `${SESSION_COOKIE}=${await createSessionToken("x".repeat(40))}`;
    expect(await status(request("GET", { ...PHONE_HOST, cookie: forged }))).toBe(401);
  });

  it("accepts writes from the allowed host's own origin", async () => {
    enableLogin();
    const cookie = `${SESSION_COOKIE}=${await createSessionToken(SECRET)}`;
    const headers = { ...PHONE_HOST, cookie, origin: "http://192.168.1.20:3000", "content-type": "application/json" };
    expect(await status(request("PATCH", headers))).toBe(200);
    expect(await status(request("PATCH", { ...headers, origin: "http://evil.example" }))).toBe(403);
  });

  it("fails closed when only half configured", async () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("APP_PASSWORD_HASH", "");
    expect(await status(request("GET", LOCAL))).toBe(503);
  });
});
