// Business emails listed in the open data. Shared by the import (cleaning)
// and the browser (mailto links). Sending is always manual: a mailto link
// opens the operator's own mail app for one recipient.

const EMAIL_PATTERN = /^[^\s@<>()[\]"',;:\\]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const MAX_EMAILS = 5;

/** Trims, lowercases, validates and de-duplicates listed emails. */
export function normalizeEmails(values: unknown): string[] {
  const list = Array.isArray(values) ? values : values === null || values === undefined ? [] : [values];
  const out: string[] = [];
  for (const value of list) {
    if (typeof value !== "string") continue;
    const email = value.trim().replace(/^mailto:/i, "").toLowerCase();
    if (email.length > 254 || !EMAIL_PATTERN.test(email) || out.includes(email)) continue;
    out.push(email);
    if (out.length >= MAX_EMAILS) break;
  }
  return out;
}

/** mailto: link for one recipient, with an optional subject and body. */
export function mailtoHref(email: string, { subject, body }: { subject?: string; body?: string } = {}): string | null {
  const [address] = normalizeEmails([email]);
  if (!address) return null;
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  // Mail apps expect %20 for spaces, not "+".
  const query = params.toString().replace(/\+/g, "%20");
  return `mailto:${address}${query ? `?${query}` : ""}`;
}
