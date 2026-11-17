import "server-only";
import type { NextRequest } from "next/server";

// Short-lived cookies that tie Google's redirect back to the browser that started it.
export const STATE_COOKIE = "huntpin_gmail_state";
export const VERIFIER_COOKIE = "huntpin_gmail_verifier";

/** Must be listed exactly under "Authorized redirect URIs" in Google Cloud. */
export function callbackUrl(request: NextRequest): string {
  return `${request.nextUrl.origin}/api/gmail/callback`;
}
