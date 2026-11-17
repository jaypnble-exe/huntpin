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

/**
 * mailto: link for one recipient, with an optional subject, body and a BCC
 * copy to the operator's own address (so their mail filter can label it).
 */
export function mailtoHref(
  email: string,
  { subject, body, bcc }: { subject?: string; body?: string; bcc?: string | null } = {},
): string | null {
  const [address] = normalizeEmails([email]);
  if (!address) return null;
  const params = new URLSearchParams();
  const [bccAddress] = normalizeEmails(bcc ? [bcc] : []);
  if (bccAddress && bccAddress !== address) params.set("bcc", bccAddress);
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  // Mail apps expect %20 for spaces, not "+".
  const query = params.toString().replace(/\+/g, "%20");
  return `mailto:${address}${query ? `?${query}` : ""}`;
}

/**
 * The operator's address with a "+tag" (you@gmail.com -> you+huntpin@gmail.com).
 * Gmail delivers it to the same inbox, and a filter on it can apply a label.
 */
export function plusAddress(email: string, tag: string): string | null {
  const [address] = normalizeEmails([email]);
  if (!address || !/^[a-z0-9]+$/.test(tag)) return null;
  const at = address.lastIndexOf("@");
  const local = address.slice(0, at).split("+")[0];
  return `${local}+${tag}${address.slice(at)}`;
}
