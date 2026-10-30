// Classifies a place's listed web presence. The labels describe what the data
// *lists*, never whether a business truly has a website.

export const WEB_PRESENCE = [
  "website_listed",
  "social_only",
  "no_website_listed",
  "possibly_closed",
] as const;

export type WebPresence = (typeof WEB_PRESENCE)[number];

// Hosts that are a social profile, link-in-bio page, or chat link rather than
// the business's own website.
const SOCIAL_HOSTS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "fb.me",
  "linktr.ee",
  "wa.me",
  "whatsapp.com",
  "tiktok.com",
  "snapchat.com",
  "x.com",
  "twitter.com",
  "t.me",
  "youtube.com",
  "linkedin.com",
  "pinterest.com",
];

function hostnameOf(url: string): string | null {
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withScheme).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

function hostMatches(url: string, hosts: string[]): boolean {
  const host = hostnameOf(url.trim());
  return host !== null && hosts.some((h) => host === h || host.endsWith(`.${h}`));
}

export function isSocialUrl(url: string): boolean {
  return hostMatches(url, SOCIAL_HOSTS);
}

export function isInstagramUrl(url: string): boolean {
  return hostMatches(url, ["instagram.com"]);
}

export interface WebPresenceInput {
  websites: string[];
  socials: string[];
  operatingStatus: string | null;
}

export function classifyWebPresence({
  websites,
  socials,
  operatingStatus,
}: WebPresenceInput): WebPresence {
  if (operatingStatus && operatingStatus !== "open") return "possibly_closed";
  if (websites.some((url) => !isSocialUrl(url))) return "website_listed";
  if (websites.length > 0 || socials.length > 0) return "social_only";
  return "no_website_listed";
}

export function hasInstagram({ websites, socials }: Pick<WebPresenceInput, "websites" | "socials">): boolean {
  return [...websites, ...socials].some(isInstagramUrl);
}
