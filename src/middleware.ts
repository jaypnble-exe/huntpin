import { NextResponse, type NextRequest } from "next/server";

// There is no authentication yet, so the app only answers on localhost.
// Replace this with real auth before deploying to a public URL.
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function hostnameOf(host: string): string {
  return host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
}

function forbidden(message: string) {
  return new NextResponse(message, { status: 403 });
}

export function middleware(request: NextRequest) {
  // Check every host the request claims, including one set by a proxy.
  const hosts = [request.headers.get("host"), request.headers.get("x-forwarded-host")]
    .filter((host): host is string => host !== null)
    .flatMap((host) => host.split(",").map((part) => hostnameOf(part.trim().toLowerCase())));
  if (hosts.length === 0 || hosts.some((host) => !LOCAL_HOSTNAMES.has(host))) {
    return forbidden("This app is restricted to localhost until authentication is added.");
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
      if (originHost === null || !LOCAL_HOSTNAMES.has(originHost)) {
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
