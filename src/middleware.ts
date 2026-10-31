import { NextResponse, type NextRequest } from "next/server";
import { authConfig, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Without login set up (APP_PASSWORD_HASH + SESSION_SECRET), the app only
// answers on localhost. With it, every page and API needs a session, and the
// app also answers on the hosts in APP_ALLOWED_HOSTS (e.g. the PC's address on
// the home network, for phone access).
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Reachable without a session (the app icons are shown on the login page too).
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout", "/icon.svg", "/apple-icon.png"]);

function hostnameOf(host: string): string {
  return host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
}

function forbidden(message: string, status = 403) {
  return new NextResponse(message, { status });
}

export async function middleware(request: NextRequest) {
  const config = authConfig(process.env);
  if (config.kind === "misconfigured") return forbidden(`Login is misconfigured: ${config.reason}`, 503);
  const allowed = (host: string) => LOCAL_HOSTNAMES.has(host) || (config.kind === "on" && config.allowedHosts.has(host));

  // Check every host the request claims, including one set by a proxy.
  const hosts = [request.headers.get("host"), request.headers.get("x-forwarded-host")]
    .filter((host): host is string => host !== null)
    .flatMap((host) => host.split(",").map((part) => hostnameOf(part.trim().toLowerCase())));
  if (hosts.length === 0 || !hosts.every(allowed)) {
    return forbidden(
      config.kind === "on"
        ? "This host is not in APP_ALLOWED_HOSTS."
        : "This app is restricted to localhost until login is set up (see docs/SETUP.md).",
    );
  }

  if (!SAFE_METHODS.has(request.method)) {
    // Block cross-site requests: another website open in the browser must not
    // be able to change data here. Browsers send Origin on these methods.
    const origin = request.headers.get("origin");
    if (origin !== null) {
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).hostname.toLowerCase();
      } catch {
        originHost = null;
      }
      if (originHost === null || !allowed(originHost)) {
        return forbidden("Cross-site requests are not allowed.");
      }
    }
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      return forbidden("Cross-site requests are not allowed.");
    }
    // JSON-only bodies force a CORS preflight for any cross-origin browser request.
    const contentType = request.headers.get("content-type");
    if (contentType !== null && !contentType.toLowerCase().startsWith("application/json")) {
      return forbidden("Request bodies must be JSON.");
    }
  }

  if (config.kind === "on" && !PUBLIC_PATHS.has(request.nextUrl.pathname)) {
    const signedIn = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, config.secret);
    if (!signedIn) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });
      }
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      login.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
