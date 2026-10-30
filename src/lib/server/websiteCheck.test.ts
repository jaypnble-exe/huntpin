import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  checkWebsite,
  isPublicAddress,
  normalizeWebsiteUrl,
  requestHeadersOnce,
  type HopResponse,
  type WebsiteCheckDeps,
} from "./websiteCheck";

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "::ffff:127.0.0.1",
    "::ffff:a00:1",
    "::FFFF:8.8.8.8",
    "0:0:0:0:0:ffff:7f00:1",
    "0000:0000:0000:0000:0000:ffff:0a00:0001",
    "::127.0.0.1",
    "fe80::1",
    "fd00::1",
    "2001:db8::1",
    "64:ff9b::a00:1",
    "not-an-ip",
  ])("blocks %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])("allows %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
});

describe("normalizeWebsiteUrl", () => {
  it("adds https and drops the fragment", () => {
    const result = normalizeWebsiteUrl(" cafe.sa/menu#top ");
    expect(result.ok && result.url.href).toBe("https://cafe.sa/menu");
  });

  it.each([
    ["", /Enter/],
    ["ftp://cafe.sa", /http and https/],
    ["file:///etc/passwd", /http and https/],
    ["javascript:alert(1)", /http and https/],
    ["https://user:pw@cafe.sa", /credentials/],
    ["http://cafe.sa:22", /ports/],
    ["https://www.instagram.com/cafe", /social profile/],
    [`https://cafe.sa/${"a".repeat(2050)}`, /too long/],
  ])("rejects %s", (input, error) => {
    const result = normalizeWebsiteUrl(input);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(error);
  });
});

function deps(
  dns: Record<string, string[]>,
  responses: Record<string, HopResponse | Error>,
): WebsiteCheckDeps & { request: ReturnType<typeof vi.fn> } {
  return {
    resolve: async (hostname) => {
      if (!(hostname in dns)) throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
      return dns[hostname].map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
    },
    request: vi.fn(async (url: URL) => {
      const response = responses[url.href];
      if (!response) throw new Error(`unexpected request ${url.href}`);
      if (response instanceof Error) throw response;
      return response;
    }),
  };
}

const url = (href: string) => new URL(href);

describe("checkWebsite", () => {
  it("reports a reachable site and follows redirects", async () => {
    const d = deps(
      { "cafe.sa": ["93.184.216.34"], "www.cafe.sa": ["93.184.216.35"] },
      {
        "http://cafe.sa/": { status: 301, location: "https://www.cafe.sa/" },
        "https://www.cafe.sa/": { status: 302, location: "/home" },
        "https://www.cafe.sa/home": { status: 200, location: null },
      },
    );
    expect(await checkWebsite(url("http://cafe.sa/"), d)).toEqual({
      status: "reachable",
      httpStatus: 200,
      finalUrl: "https://www.cafe.sa/home",
      errorCategory: null,
    });
    // Connected to the validated address.
    expect(d.request.mock.calls[0][1]).toBe("93.184.216.34");
  });

  it("never contacts a host that resolves to a private address", async () => {
    const d = deps({ "evil.example": ["93.184.216.34", "127.0.0.1"] }, {});
    expect(await checkWebsite(url("https://evil.example/"), d)).toMatchObject({
      status: "needs_manual_review",
      errorCategory: "blocked_address",
    });
    expect(d.request).not.toHaveBeenCalled();
  });

  it("blocks redirects to private addresses, metadata IPs and other schemes", async () => {
    const toMetadata = deps(
      { "cafe.sa": ["93.184.216.34"] },
      { "https://cafe.sa/": { status: 302, location: "http://169.254.169.254/latest/meta-data/" } },
    );
    expect(await checkWebsite(url("https://cafe.sa/"), toMetadata)).toMatchObject({ errorCategory: "blocked_address" });
    expect(toMetadata.request).toHaveBeenCalledTimes(1);

    const toFile = deps({ "cafe.sa": ["93.184.216.34"] }, { "https://cafe.sa/": { status: 302, location: "file:///etc/passwd" } });
    expect(await checkWebsite(url("https://cafe.sa/"), toFile)).toMatchObject({ errorCategory: "unsupported_redirect" });

    const toPort = deps({ "cafe.sa": ["93.184.216.34"] }, { "https://cafe.sa/": { status: 302, location: "http://cafe.sa:6379/" } });
    expect(await checkWebsite(url("https://cafe.sa/"), toPort)).toMatchObject({ errorCategory: "unsupported_redirect" });
  });

  it("stops after too many redirects", async () => {
    const d = deps({ "loop.sa": ["93.184.216.34"] }, { "https://loop.sa/": { status: 302, location: "/" } });
    expect(await checkWebsite(url("https://loop.sa/"), d)).toMatchObject({ errorCategory: "too_many_redirects" });
    expect(d.request).toHaveBeenCalledTimes(6);
  });

  it.each([
    [{ status: 404, location: null }, "unreachable", "not_found"],
    [{ status: 503, location: null }, "unreachable", "server_error"],
    [{ status: 403, location: null }, "needs_manual_review", "access_restricted"],
    [{ status: 429, location: null }, "needs_manual_review", "rate_limited"],
    [{ status: 418, location: null }, "needs_manual_review", "http_418"],
    [{ status: 301, location: null }, "needs_manual_review", "redirect_without_location"],
  ])("categorizes %o", async (response, status, errorCategory) => {
    const d = deps({ "cafe.sa": ["93.184.216.34"] }, { "https://cafe.sa/": response });
    expect(await checkWebsite(url("https://cafe.sa/"), d)).toMatchObject({ status, errorCategory });
  });

  it.each([
    ["ETIMEDOUT", "unreachable", "timeout"],
    ["ECONNREFUSED", "unreachable", "connection_refused"],
    ["ECONNRESET", "unreachable", "connection_reset"],
    ["CERT_HAS_EXPIRED", "needs_manual_review", "tls_error"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "needs_manual_review", "tls_error"],
    ["EWHATEVER", "unreachable", "network_error"],
  ])("maps network error %s", async (code, status, errorCategory) => {
    const d = deps({ "cafe.sa": ["93.184.216.34"] }, { "https://cafe.sa/": Object.assign(new Error(code), { code }) });
    expect(await checkWebsite(url("https://cafe.sa/"), d)).toMatchObject({ status, errorCategory });
  });

  it("reports domains that do not resolve", async () => {
    const d = deps({}, {});
    expect(await checkWebsite(url("https://expired-domain.sa/"), d)).toMatchObject({
      status: "unreachable",
      errorCategory: "dns_not_found",
    });
  });
});

describe("requestHeadersOnce", () => {
  let server: Server;
  let port: number;
  let bodyBytesSent = 0;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/slow") return; // never responds
      res.writeHead(200, { "Content-Type": "text/html" });
      // A large body that must not be downloaded.
      const chunk = Buffer.alloc(64 * 1024, "a");
      const write = () => {
        while (bodyBytesSent < 50 * 1024 * 1024 && res.write(chunk)) bodyBytesSent += chunk.length;
      };
      res.on("drain", write);
      res.on("close", () => res.removeAllListeners("drain"));
      write();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  // The test server is on loopback, which checkWebsite blocks; this calls the
  // low-level request directly to verify pinning, header-only reads and timeouts.
  it("connects to the pinned address and stops after the headers", async () => {
    const response = await requestHeadersOnce(new URL(`http://unresolvable.invalid:${port}/`), "127.0.0.1", 4, 2000);
    expect(response.status).toBe(200);
    await new Promise((r) => setTimeout(r, 200));
    expect(bodyBytesSent).toBeLessThan(10 * 1024 * 1024);
  });

  it("times out", async () => {
    await expect(requestHeadersOnce(new URL(`http://127.0.0.1:${port}/slow`), "127.0.0.1", 4, 300)).rejects.toMatchObject({
      code: "ETIMEDOUT",
    });
  });
});
