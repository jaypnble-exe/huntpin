// Short, read-only dates for a lead's activity summary.
import { DEFAULT_TIME_ZONE, localDate } from "./followUps";

function dayNumber(date: string): number {
  return Math.round(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000);
}

/**
 * "Today", "Yesterday", "3 days ago" within a fortnight, else a short date
 * ("12 Oct" this year, "12 Oct 2025" before). Calendar days in the
 * operator's time zone.
 */
export function relativeDay(timestamp: string, now: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const then = new Date(timestamp);
  if (Number.isNaN(then.getTime())) return "Unknown";
  const days = dayNumber(localDate(now, timeZone)) - dayNumber(localDate(then, timeZone));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  const sameYear = localDate(then, timeZone).slice(0, 4) === localDate(now, timeZone).slice(0, 4);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(then);
}

/** Full date and time, for a tooltip next to a relative date. */
export function fullDateTime(timestamp: string, timeZone = DEFAULT_TIME_ZONE): string {
  const then = new Date(timestamp);
  if (Number.isNaN(then.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(then);
}
