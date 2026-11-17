import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ensureLabel, getProfileEmail } from "@/lib/server/gmail/api";
import { GMAIL_LABEL, gmailConfig } from "@/lib/server/gmail/config";
import { encryptSecret } from "@/lib/server/gmail/crypto";
import { callbackUrl, STATE_COOKIE, VERIFIER_COOKIE } from "@/lib/server/gmail/flow";
import { exchangeCode, GMAIL_SCOPE } from "@/lib/server/gmail/oauth";
import { saveConnection } from "@/lib/server/gmail/store";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameToken(a: string | undefined, b: string | null): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// GET /api/gmail/callback?code=&state=   Google sends the operator back here
export async function GET(request: NextRequest) {
  const done = (outcome: string) => {
    const response = NextResponse.redirect(new URL(`/templates?gmail=${outcome}`, request.nextUrl.origin));
    response.cookies.set(STATE_COOKIE, "", { path: "/api/gmail", maxAge: 0 });
    response.cookies.set(VERIFIER_COOKIE, "", { path: "/api/gmail", maxAge: 0 });
    return response;
  };

  const config = gmailConfig();
  if (config.kind !== "on") return done("not_configured");
  const params = request.nextUrl.searchParams;
  if (!sameToken(request.cookies.get(STATE_COOKIE)?.value, params.get("state"))) return done("expired");
  if (params.get("error")) return done("denied");
  const code = params.get("code");
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value;
  if (!code || code.length > 2048 || !verifier) return done("failed");

  try {
    const tokens = await exchangeCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: callbackUrl(request),
      code,
      verifier,
    });
    // The consent screen lets the operator untick Gmail access.
    if (!tokens.scope.split(" ").includes(GMAIL_SCOPE)) return done("scope_missing");
    const email = await getProfileEmail(tokens.accessToken);
    const labelId = await ensureLabel(tokens.accessToken, GMAIL_LABEL);
    await saveConnection(getSupabaseAdmin(), {
      email,
      refreshTokenEnc: encryptSecret(tokens.refreshToken, config.tokenKey),
      labelId,
    });
    return done("connected");
  } catch {
    return done("failed");
  }
}
