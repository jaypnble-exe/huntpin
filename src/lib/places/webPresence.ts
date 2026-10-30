// Classifies a place's listed web presence. The labels describe what the data
// *lists*, never whether a business truly has a website.

export const WEB_PRESENCE = [
  "website_listed",
  "social_only",
  "no_website_listed",
  // Source rarely records websites (Foursquare), so nothing listed proves little.
  "unknown",
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

export const SOCIAL_PLATFORMS = {
  instagram: { label: "Instagram", hosts: ["instagram.com"] },
  facebook: { label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"] },
  x: { label: "X (Twitter)", hosts: ["x.com", "twitter.com"] },
  tiktok: { label: "TikTok", hosts: ["tiktok.com"] },
  whatsapp: { label: "WhatsApp", hosts: ["wa.me", "whatsapp.com"] },
  youtube: { label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  linkedin: { label: "LinkedIn", hosts: ["linkedin.com"] },
  snapchat: { label: "Snapchat", hosts: ["snapchat.com"] },
  telegram: { label: "Telegram", hosts: ["t.me"] },
  linktree: { label: "Linktree", hosts: ["linktr.ee"] },
  pinterest: { label: "Pinterest", hosts: ["pinterest.com"] },
} as const;

export type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;

/** Which social platform a URL belongs to, or null for an ordinary website. */
export function socialPlatform(url: string): SocialPlatform | null {
  for (const [key, platform] of Object.entries(SOCIAL_PLATFORMS)) {
    if (hostMatches(url, [...platform.hosts])) return key as SocialPlatform;
  }
  return null;
}

/** Short, readable handle for a social URL (e.g. "mykonos.sa"), or null. */
export function socialHandle(url: string): string | null {
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
    const first = parsed.pathname.split("/").filter(Boolean)[0];
    if (!first || /^(profile\.php|pages|p|reel|watch|share|sharer)$/i.test(first)) return null;
    return decodeURIComponent(first).replace(/^@/, "").slice(0, 40);
  } catch {
    return null;
  }
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
