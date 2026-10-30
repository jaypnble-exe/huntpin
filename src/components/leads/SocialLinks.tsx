import type { ReactNode } from "react";
import { IconGlobe, cn } from "@/components/ui";
import { safeHref } from "@/lib/places/links";
import { SOCIAL_PLATFORMS, socialHandle, socialPlatform, type SocialPlatform } from "@/lib/places/webPresence";

// Brand marks drawn inline (no icon package). White glyph on the brand colour.
const BRANDS: Record<SocialPlatform, { background: string; dark?: boolean; glyph: ReactNode }> = {
  instagram: {
    background: "linear-gradient(45deg, #f58529, #dd2a7b 45%, #8134af 75%, #515bd4)",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="4.5" />
        <circle cx="12" cy="12" r="3.6" />
        <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
      </g>
    ),
  },
  facebook: {
    background: "#1877F2",
    glyph: <path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3.1h-3V8.5c0-.9.3-1.5 1.6-1.5h1.6V4.2c-.3 0-1.2-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.2H7.7v3.1h2.6V21z" />,
  },
  x: {
    background: "#000000",
    glyph: <path fill="currentColor" d="M17.3 4h2.9l-6.3 7.2L21.3 20h-5.8l-4.5-5.9L5.8 20H2.9l6.7-7.7L2.5 4h5.9l4.1 5.4zm-1 14.3h1.6L7.8 5.6H6.1z" />,
  },
  tiktok: {
    background: "#000000",
    glyph: <path fill="currentColor" d="M16.2 3.5c.4 2 1.7 3.3 3.8 3.5v2.9c-1.4.1-2.7-.3-3.8-1v6c0 3.1-2.3 5.6-5.5 5.6S5.2 18 5.2 15s2.5-5.4 5.7-5.3v3c-1.4-.2-2.6.8-2.6 2.3 0 1.4 1.1 2.5 2.5 2.5s2.5-1 2.5-2.7V3.5z" />,
  },
  whatsapp: {
    background: "#25D366",
    glyph: (
      <g>
        <path fill="none" stroke="currentColor" strokeWidth="1.8" d="M4 20l1.2-3.9A8 8 0 1 1 8 18.9z" />
        <path fill="currentColor" d="M9.3 7.8c.2 0 .5 0 .6.4l.8 1.8c.1.2 0 .4-.1.6l-.6.7c.6 1.2 1.6 2.2 2.8 2.8l.7-.6c.2-.2.4-.2.6-.1l1.8.8c.3.1.4.4.4.6 0 1.2-1 2-2.2 1.9-3.1-.3-6.1-3.3-6.4-6.4-.1-1.2.7-2.3 1.6-2.5z" />
      </g>
    ),
  },
  youtube: {
    background: "#FF0000",
    glyph: <path fill="currentColor" d="M10 8.5v7l6-3.5z" />,
  },
  linkedin: {
    background: "#0A66C2",
    glyph: <path fill="currentColor" d="M6.6 9.3h2.8v8.9H6.6zM8 4.8a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zm3.2 4.5h2.7v1.2c.4-.7 1.3-1.4 2.7-1.4 2.9 0 3.4 1.9 3.4 4.3v4.8h-2.8V14c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2v4.3h-2.8z" />,
  },
  snapchat: {
    background: "#FFFC00",
    dark: true,
    glyph: <path fill="currentColor" d="M12 4c2.6 0 4.3 2 4.3 4.6v1.8l1.3-.4c.5 0 .8.6.3.9l-1.6.8c.4 1.4 1.6 2.6 3 3 .3.1.3.6 0 .7-.8.3-1.6.4-2 .9l-.2.9c-.8-.1-1.7-.2-2.5.3-.8.5-1.5 1.1-2.6 1.1s-1.8-.6-2.6-1.1c-.8-.5-1.7-.4-2.5-.3l-.2-.9c-.4-.5-1.2-.6-2-.9-.3-.1-.3-.6 0-.7 1.4-.4 2.6-1.6 3-3l-1.6-.8c-.5-.3-.2-.9.3-.9l1.3.4V8.6C7.7 6 9.4 4 12 4z" />,
  },
  telegram: {
    background: "#229ED9",
    glyph: <path fill="currentColor" d="M3.5 11.4 19.8 5c.8-.3 1.4.2 1.2 1.3l-2.8 13c-.2.9-.8 1.1-1.5.7l-4.2-3.1-2 2c-.2.2-.4.4-.9.4l.3-4.3 7.8-7c.3-.3-.1-.5-.5-.2l-9.6 6-4.1-1.3c-.9-.3-.9-.9.2-1.3z" />,
  },
  linktree: {
    background: "#43E55E",
    dark: true,
    glyph: <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" d="M12 3.5v17M5 7.5l14 8M19 7.5l-14 8" />,
  },
  pinterest: {
    background: "#E60023",
    glyph: <path fill="currentColor" d="M12.3 3.5c-4.7 0-7 3.2-7 5.9 0 1.6.6 3.1 1.9 3.6.2.1.4 0 .5-.2l.2-.8c.1-.3 0-.4-.2-.6-.4-.5-.6-1.1-.6-1.9 0-2.5 1.8-4.6 4.8-4.6 2.6 0 4 1.6 4 3.7 0 2.8-1.2 5.1-3 5.1-1 0-1.8-.8-1.5-1.9.3-1.2.9-2.6.9-3.5 0-.8-.4-1.5-1.3-1.5-1.1 0-1.9 1.1-1.9 2.6 0 .9.3 1.6.3 1.6l-1.3 5.4c-.4 1.6 0 3.5 0 3.7 0 .1.2.1.2 0 .1-.1 1.4-1.7 1.8-3.3l.7-2.7c.4.7 1.4 1.3 2.5 1.3 3.3 0 5.5-3 5.5-7 0-3-2.6-5.9-6.5-5.9z" />,
  },
};

function SocialButton({ url, platform }: { url: string; platform: SocialPlatform }) {
  const href = safeHref(url);
  const brand = BRANDS[platform];
  const handle = socialHandle(url);
  const name = SOCIAL_PLATFORMS[platform].label;
  const label = handle ? `${name}: ${handle}` : name;
  const content = (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
      {brand.glyph}
    </svg>
  );
  const className = cn(
    "inline-flex h-10 w-10 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 transition-transform hover:scale-105",
    brand.dark ? "text-black" : "text-white",
  );
  if (!href) {
    return (
      <span title={label} aria-label={label} className={className} style={{ background: brand.background }}>
        {content}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={label}
      aria-label={`${label} (opens in a new tab)`}
      className={className}
      style={{ background: brand.background }}
    >
      {content}
    </a>
  );
}

function domainOf(url: string): string {
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Websites as short domain links, social profiles as brand-logo buttons
 * (hover or screen reader gives the platform and handle).
 */
export function SocialLinks({ urls, className }: { urls: string[]; className?: string }) {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  const socials = unique
    .map((url) => ({ url, platform: socialPlatform(url) }))
    .filter((item): item is { url: string; platform: SocialPlatform } => item.platform !== null);
  const websites = unique.filter((url) => socialPlatform(url) === null);
  if (socials.length === 0 && websites.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {websites.length > 0 && (
        <ul className="space-y-1 text-sm">
          {websites.map((url) => {
            const href = safeHref(url);
            return (
              <li key={url} className="flex items-center gap-2">
                <IconGlobe className="h-4 w-4 shrink-0 text-muted" />
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer nofollow" title={url} className="truncate text-info hover:underline" dir="ltr">
                    {domainOf(url)}
                  </a>
                ) : (
                  <span className="truncate" dir="ltr">
                    {url}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {socials.length > 0 && (
        <ul aria-label="Social profiles" className="flex flex-wrap gap-2">
          {socials.map(({ url, platform }) => (
            <li key={url}>
              <SocialButton url={url} platform={platform} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
