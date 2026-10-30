import "server-only";
import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { isSocialUrl } from "../places/webPresence";

// Manual, lightweight website check (SSRF-protected). One GET per hop, only
// the status line and headers are read; the body is never downloaded or stored.
// Makes no Google requests.

export type WebsiteCheckStatus = "reachable" | "unreachable" | "needs_manual_review";

export interface WebsiteCheckResult {
  status: WebsiteCheckStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  errorCategory: string | null;
}

export const MAX_WEBSITE_URL_LENGTH = 2048;
const MAX_REDIRECTS = 5;
const HOP_TIMEOUT_MS = 8_000;
const TOTAL_TIMEOUT_MS = 20_000;
const ALLOWED_PORTS = new Set(["", "80", "443"]);
const USER_AGENT = "LeadRadar-website-check/1.0 (manual single check)";

// Private, loopback, link-local, shared, documentation, multicast and other
// reserved ranges. Anything here is never contacted.
const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  // IPv4-mapped (::ffff:0:0/96) is handled in isPublicAddress: Node's BlockList
  // also matches plain IPv4 addresses against that rule, which would block all.
  ["64:ff9b::", 96], // NAT64
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23], // includes Teredo
  ["2001:db8::", 32],
  ["2002::", 16], // 6to4
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  BLOCKED.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (family === 6) {
    const groups = ipv6Groups(address);
    if (!groups) return false;
    // IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96) forms, in any spelling.
    if (groups.slice(0, 5).every((g) => g === 0) && (groups[5] === 0xffff || groups[5] === 0)) return false;
  }
  return !BLOCKED.check(address, family === 4 ? "ipv4" : "ipv6");
}

/** Expands an IPv6 address (including "::" and an embedded IPv4 tail) into 8 groups. */
function ipv6Groups(address: string): number[] | null {
  let text = address.toLowerCase().split("%")[0];
  const v4Tail = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4Tail) {
    const [a, b, c, d] = v4Tail.slice(1).map(Number);
    text = `${text.slice(0, v4Tail.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.split("::");
  const parse = (part: string | undefined) => (part ? part.split(":").map((g) => parseInt(g, 16)) : []);
  const front = parse(head);
  const back = parse(tail);
  const missing = 8 - front.length - back.length;
  if (text.includes("::") ? missing < 0 : missing !== 0) return null;
  const groups = [...front, ...Array<number>(text.includes("::") ? missing : 0).fill(0), ...back];
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

export type NormalizedUrl = { ok: true; url: URL } | { ok: false; error: string };

/** Validates a URL before any request is made. Shared rules for redirects. */
export function normalizeWebsiteUrl(input: string): NormalizedUrl {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter a website URL." };
  if (trimmed.length > MAX_WEBSITE_URL_LENGTH) return { ok: false, error: "URL is too long." };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "That is not a valid URL." };
  }
  const problem = urlProblem(url);
  if (problem) return { ok: false, error: problem };
  if (isSocialUrl(url.href)) return { ok: false, error: "That is a social profile, not a website." };
  url.hash = "";
  return { ok: true, url };
}

function urlProblem(url: URL): string | null {
  if (url.protocol !== "http:" && url.protocol !== "https:") return "Only http and https URLs can be checked.";
  if (url.username || url.password) return "URLs with credentials are not allowed.";
  if (!ALLOWED_PORTS.has(url.port)) return "Only the standard web ports (80 and 443) can be checked.";
  if (!url.hostname) return "URL has no host.";
  return null;
}

export interface HopResponse {
  status: number;
  location: string | null;
}

export interface WebsiteCheckDeps {
  resolve: (hostname: string) => Promise<{ address: string; family: number }[]>;
  request: (url: URL, address: string, family: number, timeoutMs: number) => Promise<HopResponse>;
}

/** One GET to a pinned, pre-validated IP. Resolves as soon as headers arrive. */
export function requestHeadersOnce(url: URL, address: string, family: number, timeoutMs: number): Promise<HopResponse> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    // Pin the connection to the address that was validated (no DNS rebinding).
    const pinnedLookup = ((_host: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
      if (options?.all) callback(null, [{ address, family }]);
      else callback(null, address, family);
    }) as unknown as LookupFunction;

    const request = (isHttps ? https : http).request(
      {
        protocol: url.protocol,
        hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "Accept-Encoding": "identity",
          Connection: "close",
        },
        lookup: pinnedLookup,
        servername: isIP(hostname) ? undefined : hostname,
        agent: false,
        timeout: timeoutMs,
      },
      (response) => {
        const location = response.headers.location;
        resolve({ status: response.statusCode ?? 0, location: typeof location === "string" ? location : null });
        // Never read the body.
        response.destroy();
        request.destroy();
      },
    );
    const hardTimeout = setTimeout(() => request.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })), timeoutMs);
    request.on("timeout", () => request.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
    request.on("error", reject);
    request.on("close", () => clearTimeout(hardTimeout));
    request.end();
  });
}

const DEFAULT_DEPS: WebsiteCheckDeps = {
  resolve: (hostname) => dnsLookup(hostname, { all: true, verbatim: true }),
  request: requestHeadersOnce,
};

function networkErrorResult(error: unknown, finalUrl: string): WebsiteCheckResult {
  const code = String((error as { code?: unknown })?.code ?? "");
  const unreachable = (errorCategory: string): WebsiteCheckResult => ({
    status: "unreachable",
    httpStatus: null,
    finalUrl,
    errorCategory,
  });
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") return unreachable("timeout");
  if (code === "ECONNREFUSED") return unreachable("connection_refused");
  if (code === "ECONNRESET" || code === "EPIPE") return unreachable("connection_reset");
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH") return unreachable("network_unreachable");
  if (/^(CERT_|ERR_TLS|ERR_SSL|DEPTH_ZERO|SELF_SIGNED|UNABLE_TO_|ERR_CERT|HOSTNAME_MISMATCH)/.test(code) || code.includes("CERT")) {
    // The site exists but its HTTPS is broken: worth a manual look.
    return { status: "needs_manual_review", httpStatus: null, finalUrl, errorCategory: "tls_error" };
  }
  return unreachable("network_error");
}

function statusResult(status: number, finalUrl: string): WebsiteCheckResult {
  const result = (s: WebsiteCheckStatus, errorCategory: string | null): WebsiteCheckResult => ({
    status: s,
    httpStatus: status,
    finalUrl,
    errorCategory,
  });
  if (status >= 200 && status < 300) return result("reachable", null);
  if (status === 401 || status === 403) return result("needs_manual_review", "access_restricted");
  if (status === 429) return result("needs_manual_review", "rate_limited");
  if (status === 404 || status === 410) return result("unreachable", "not_found");
  if (status >= 500) return result("unreachable", "server_error");
  return result("needs_manual_review", `http_${status}`);
}

/**
 * Checks one website: validates every hop, resolves DNS, requires every
 * resolved address to be public, connects only to that address, follows at
 * most MAX_REDIRECTS redirects. Never throws.
 */
export async function checkWebsite(start: URL, deps: WebsiteCheckDeps = DEFAULT_DEPS): Promise<WebsiteCheckResult> {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let url = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const problem = urlProblem(url);
    if (problem) {
      return { status: "needs_manual_review", httpStatus: null, finalUrl: url.href, errorCategory: "unsupported_redirect" };
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    let addresses: { address: string; family: number }[];
    if (isIP(hostname)) {
      addresses = [{ address: hostname, family: isIP(hostname) }];
    } else {
      try {
        addresses = await deps.resolve(hostname);
      } catch (error) {
        const code = String((error as { code?: unknown })?.code ?? "");
        const category = code === "ENOTFOUND" || code === "ENODATA" ? "dns_not_found" : "dns_error";
        return { status: "unreachable", httpStatus: null, finalUrl: url.href, errorCategory: category };
      }
    }
    if (addresses.length === 0) {
      return { status: "unreachable", httpStatus: null, finalUrl: url.href, errorCategory: "dns_not_found" };
    }
    if (!addresses.every((a) => isPublicAddress(a.address))) {
      return { status: "needs_manual_review", httpStatus: null, finalUrl: url.href, errorCategory: "blocked_address" };
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) return { status: "unreachable", httpStatus: null, finalUrl: url.href, errorCategory: "timeout" };

    let response: HopResponse;
    try {
      response = await deps.request(url, addresses[0].address, addresses[0].family, Math.min(HOP_TIMEOUT_MS, remaining));
    } catch (error) {
      return networkErrorResult(error, url.href);
    }

    if (response.status >= 300 && response.status < 400) {
      if (!response.location) {
        return { status: "needs_manual_review", httpStatus: response.status, finalUrl: url.href, errorCategory: "redirect_without_location" };
      }
      try {
        url = new URL(response.location, url);
      } catch {
        return { status: "needs_manual_review", httpStatus: response.status, finalUrl: url.href, errorCategory: "invalid_redirect" };
      }
      continue;
    }
    return statusResult(response.status, url.href);
  }

  return { status: "needs_manual_review", httpStatus: null, finalUrl: url.href, errorCategory: "too_many_redirects" };
}
