import { NextResponse, type NextRequest } from "next/server";
import { gmailConfig } from "@/lib/server/gmail/config";
import { callbackUrl, STATE_COOKIE, VERIFIER_COOKIE } from "@/lib/server/gmail/flow";
import { authorizationUrl, randomToken } from "@/lib/server/gmail/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/gmail/connect   sends the operator to Google to allow Gmail access
export async function GET(request: NextRequest) {
  const config = gmailConfig();
  if (config.kind !== "on") {
    return NextResponse.redirect(new URL("/templates?gmail=not_configured", request.nextUrl.origin));
  }
  const state = randomToken();
  const verifier = randomToken();
  const response = NextResponse.redirect(
    authorizationUrl({ clientId: config.clientId, redirectUri: callbackUrl(request), state, verifier }),
  );
  const cookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: request.nextUrl.protocol === "https:",
    path: "/api/gmail",
    maxAge: 600,
  };
  response.cookies.set(STATE_COOKIE, state, cookie);
  response.cookies.set(VERIFIER_COOKIE, verifier, cookie);
  return response;
}
