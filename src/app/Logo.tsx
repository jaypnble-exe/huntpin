import { useId } from "react";

/** The HuntPin mark: a map pin with a crosshair. Same drawing as app/icon.svg (the favicon). */
export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  const gradient = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${gradient})`} />
      <path d="M32 56S15 40.5 15 27a17 17 0 0 1 34 0C49 40.5 32 56 32 56Z" fill="#fff" />
      <g stroke="#1e40af" strokeWidth="3.2" strokeLinecap="round" fill="none">
        <circle cx="32" cy="27" r="7.5" />
        <path d="M32 14.5v4M32 35.5v4M19.5 27h4M40.5 27h4" />
      </g>
      <circle cx="32" cy="27" r="2.6" fill="#f97316" />
    </svg>
  );
}
