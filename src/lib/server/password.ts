import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Password hash for APP_PASSWORD_HASH: scrypt:<N>:<r>:<p>:<salt>:<hash>, base64url.
// No "$" characters, so .env files don't try to expand it.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 10;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join(":");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  // Refuse silly parameters rather than hang or allocate too much.
  if (![n, r, p].every(Number.isSafeInteger) || n < 1024 || n > 1 << 20 || r < 1 || r > 32 || p < 1 || p > 4) return false;
  const expected = Buffer.from(parts[5], "base64url");
  if (expected.length !== KEY_LENGTH || password.length > 1000) return false;
  const actual = await derive(password, Buffer.from(parts[4], "base64url"), n, r, p);
  return timingSafeEqual(actual, expected);
}
