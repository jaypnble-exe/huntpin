import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

function request(method: string, headers: Record<string, string>) {
  return new NextRequest("http://localhost:3000/api/leads", { method, headers });
}

const LOCAL = { host: "localhost:3000" };

describe("middleware", () => {
  it("allows local reads and same-origin JSON writes", () => {
    expect(middleware(request("GET", LOCAL)).status).toBe(200);
    expect(
      middleware(
        request("POST", { ...LOCAL, origin: "http://localhost:3000", "content-type": "application/json" }),
      ).status,
    ).toBe(200);
    expect(middleware(request("DELETE", LOCAL)).status).toBe(200);
  });

  it("blocks non-local hosts", () => {
    expect(middleware(request("GET", { host: "example.com" })).status).toBe(403);
    expect(middleware(request("GET", { ...LOCAL, "x-forwarded-host": "evil.example" })).status).toBe(403);
  });

  it("blocks cross-site writes", () => {
    expect(
      middleware(request("POST", { ...LOCAL, origin: "https://evil.example", "content-type": "application/json" }))
        .status,
    ).toBe(403);
    expect(middleware(request("PATCH", { ...LOCAL, origin: "null" })).status).toBe(403);
    expect(middleware(request("DELETE", { ...LOCAL, "sec-fetch-site": "cross-site" })).status).toBe(403);
  });

  it("blocks non-JSON write bodies (form or text/plain CSRF)", () => {
    expect(middleware(request("POST", { ...LOCAL, "content-type": "text/plain" })).status).toBe(403);
    expect(
      middleware(request("POST", { ...LOCAL, "content-type": "application/x-www-form-urlencoded" })).status,
    ).toBe(403);
  });
});
