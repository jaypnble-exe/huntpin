import "server-only";
import { createHash, randomBytes } from "node:crypto";

// Google OAuth 2.0 for a web server app, with PKCE. One scope: gmail.modify
// (create drafts, apply the HUNTPIN label, read reply metadata). HuntPin
// never sends email; the operator sends each draft in Gmail.

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const TIMEOUT_MS = 10_000;

/** Gmail access was revoked or expired: the operator must connect again. */
export class GmailAuthError extends Error {}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function authorizationUrl(o: { clientId: string; redirectUri: string; state: string; verifier: string }): string {
  const params = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    // Always ask, so Google returns a refresh token on every connect.
    prompt: "consent",
    state: o.state,
    code_challenge: codeChallenge(o.verifier),
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}

async function tokenRequest(body: Record<string, string>, fetchFn: typeof fetch): Promise<TokenResponse> {
  const response = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok) {
    // invalid_grant: access was revoked, or the token expired.
    if (json.error === "invalid_grant") throw new GmailAuthError("invalid_grant");
    throw new Error("token_request_failed");
  }
  return json;
}

export async function exchangeCode(
  o: { clientId: string; clientSecret: string; redirectUri: string; code: string; verifier: string },
  fetchFn: typeof fetch = fetch,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number; scope: string }> {
  const json = await tokenRequest(
    {
      grant_type: "authorization_code",
      code: o.code,
      client_id: o.clientId,
      client_secret: o.clientSecret,
      redirect_uri: o.redirectUri,
      code_verifier: o.verifier,
    },
    fetchFn,
  );
  if (!json.access_token || !json.refresh_token) throw new Error("token_missing");
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    scope: json.scope ?? "",
  };
}

export async function refreshAccessToken(
  o: { clientId: string; clientSecret: string; refreshToken: string },
  fetchFn: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresAt: number }> {
  const json = await tokenRequest(
    { grant_type: "refresh_token", refresh_token: o.refreshToken, client_id: o.clientId, client_secret: o.clientSecret },
    fetchFn,
  );
  if (!json.access_token) throw new Error("token_missing");
  return { accessToken: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
}

/** Best effort: tells Google to drop HuntPin's access. */
export async function revokeToken(token: string, fetchFn: typeof fetch = fetch): Promise<void> {
  await fetchFn(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => undefined);
}
