import "server-only";

// Optional Gmail connection: drafts in the operator's Gmail with a HUNTPIN
// label, and a reply check. Off unless all three settings are present.
type Env = Record<string, string | undefined>;

export type GmailConfig =
  | { kind: "off" }
  | { kind: "misconfigured"; reason: string }
  | { kind: "on"; clientId: string; clientSecret: string; tokenKey: Buffer };

export function gmailConfig(env: Env = process.env): GmailConfig {
  const clientId = env.GMAIL_CLIENT_ID?.trim();
  const clientSecret = env.GMAIL_CLIENT_SECRET?.trim();
  const tokenKey = env.GMAIL_TOKEN_KEY?.trim();
  if (!clientId && !clientSecret && !tokenKey) return { kind: "off" };
  if (!clientId || !clientSecret || !tokenKey) {
    return { kind: "misconfigured", reason: "Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_TOKEN_KEY together." };
  }
  if (!clientId.endsWith(".apps.googleusercontent.com")) {
    return { kind: "misconfigured", reason: "GMAIL_CLIENT_ID should end in .apps.googleusercontent.com." };
  }
  const key = Buffer.from(tokenKey, "base64");
  if (key.length !== 32) {
    return { kind: "misconfigured", reason: "GMAIL_TOKEN_KEY must be 32 random bytes in base64 (npm run gmail:key)." };
  }
  return { kind: "on", clientId, clientSecret, tokenKey: key };
}

/** The label HuntPin puts on its drafts and conversations. */
export const GMAIL_LABEL = "HUNTPIN";
/** The +tag of the BCC copy (you+huntpin@gmail.com). */
export const BCC_TAG = "huntpin";
