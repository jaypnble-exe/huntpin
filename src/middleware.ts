import { NextResponse, type NextRequest } from "next/server";

// There is no authentication yet, so the app only answers on localhost.
// Replace this with real auth before deploying to a public URL.
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function hostnameOf(host: string): string {
  return host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
}

export function middleware(request: NextRequest) {
  // Check every host the request claims, including one set by a proxy.
  const hosts = [request.headers.get("host"), request.headers.get("x-forwarded-host")]
    .filter((host): host is string => host !== null)
    .flatMap((host) => host.split(",").map((part) => hostnameOf(part.trim().toLowerCase())));
  if (hosts.length === 0 || hosts.some((host) => !LOCAL_HOSTNAMES.has(host))) {
    return new NextResponse("This app is restricted to localhost until authentication is added.", {
      status: 403,
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
