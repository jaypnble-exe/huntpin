import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const REQUEST_TIMEOUT_MS = 5_000;

type Env = Record<string, string | undefined>;

/**
 * Server-only Supabase client using the secret key (bypasses RLS). Throws if
 * not configured, so callers fail closed. Never import this from client code.
 */
export function createSupabaseAdmin(
  env: Env = process.env,
  fetchFn: typeof fetch = fetch,
): SupabaseClient {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) throw new Error("Supabase is not configured");

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Fail fast instead of retrying with backoff; callers refuse the search.
    db: { retry: false },
    global: {
      // Strict timeout and no Next.js fetch caching for database calls.
      fetch: (input, init) =>
        fetchFn(input, {
          ...init,
          cache: "no-store",
          signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }),
    },
  });
}

const globalForSupabase = globalThis as { __clientFinderSupabase?: SupabaseClient };

export function getSupabaseAdmin(): SupabaseClient {
  globalForSupabase.__clientFinderSupabase ??= createSupabaseAdmin();
  return globalForSupabase.__clientFinderSupabase;
}
