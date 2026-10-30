// Operator login: one password, a signed session cookie. Uses Web Crypto only,
// so it runs in the middleware as well as in route handlers.
//
// Auth is on when APP_PASSWORD_HASH and SESSION_SECRET are both set. Without
// them the app only answers on localhost (as before). Half-configured auth
// fails closed.

export const SESSION_COOKIE = "leadradar_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MIN_SECRET_LENGTH = 32;

export type AuthConfig =
  | { kind: "off" }
  | { kind: "on"; passwordHash: string; secret: string; allowedHosts: Set<string> }
  | { kind: "misconfigured"; reason: string };

/** Hostnames from APP_ALLOWED_HOSTS (comma-separated), lowercased, ports removed. */
export function parseAllowedHosts(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
      .map((host) => (host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0])),
  );
}

export function authConfig(env: Record<string, string | undefined>): AuthConfig {
  const passwordHash = env.APP_PASSWORD_HASH?.trim() ?? "";
  const secret = env.SESSION_SECRET?.trim() ?? "";
  if (!passwordHash && !secret) return { kind: "off" };
  if (!passwordHash || !secret) return { kind: "misconfigured", reason: "Set both APP_PASSWORD_HASH and SESSION_SECRET, or neither." };
  if (secret.length < MIN_SECRET_LENGTH) return { kind: "misconfigured", reason: `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters.` };
  if (!passwordHash.startsWith("scrypt:")) return { kind: "misconfigured", reason: "APP_PASSWORD_HASH must come from npm run auth:setup." };
  return { kind: "on", passwordHash, secret, allowedHosts: parseAllowedHosts(env.APP_ALLOWED_HOSTS) };
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

/** `v1.<expiresAtMs>.<random>.<signature>` */
export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const payload = `v1.${now + SESSION_TTL_MS}.${base64url(crypto.getRandomValues(new Uint8Array(16)))}`;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), new TextEncoder().encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

/** True for an unexpired token signed with this secret (constant-time check). */
export async function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  const signature = fromBase64url(parts[3]);
  if (!signature) return false;
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, "verify"),
    signature as Uint8Array<ArrayBuffer>,
    new TextEncoder().encode(parts.slice(0, 3).join(".")),
  );
}

/** A same-site path to return to after login; anything else goes home. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.length > 500) return "/";
  return value;
}
