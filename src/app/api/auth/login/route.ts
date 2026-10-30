import { NextResponse, type NextRequest } from "next/server";
import { authConfig, createSessionToken, safeNextPath, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/server/password";
import { createRateLimiter } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Single operator: one global limit on login attempts (resets on restart).
const attempts = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

function isHttps(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
}

// POST /api/auth/login { password, next? }
export async function POST(request: NextRequest) {
  const config = authConfig(process.env);
  if (config.kind !== "on") {
    return NextResponse.json({ ok: false, message: "Login is not set up. See docs/SETUP.md (Phone access)." }, { status: 503 });
  }
  if (!attempts.tryAcquire(Date.now())) {
    return NextResponse.json({ ok: false, message: "Too many attempts. Wait 15 minutes." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body must be JSON." }, { status: 400 });
  }
  const { password, next } = (body ?? {}) as { password?: unknown; next?: unknown };
  if (typeof password !== "string" || password.length === 0 || password.length > 1000) {
    return NextResponse.json({ ok: false, message: "Enter your password." }, { status: 400 });
  }
  if (!(await verifyPassword(password, config.passwordHash))) {
    return NextResponse.json({ ok: false, message: "Wrong password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, next: safeNextPath(typeof next === "string" ? next : null) });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(config.secret), {
    httpOnly: true,
    sameSite: "lax",
    // Secure on https; plain http is only used on the home network.
    secure: isHttps(request),
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return response;
}
