// Lead scoring and chain detection. Pure functions shared by the import
// script (stores the score) and the app (explains it).
import { CATEGORY_GROUPS, type CategoryGroup } from "./categories";
import type { WebPresence } from "./webPresence";

/** Names at this many locations or more in an area are treated as chains. */
export const CHAIN_MIN_LOCATIONS = 3;

/** Category groups you sell to. Override with LEAD_TARGET_CATEGORIES (comma-separated keys). */
export const DEFAULT_TARGET_GROUPS: CategoryGroup[] = ["food", "beauty", "health", "retail"];

export function parseTargetGroups(value: string | undefined): CategoryGroup[] {
  if (!value?.trim()) return DEFAULT_TARGET_GROUPS;
  const groups = value.split(",").map((v) => v.trim()).filter(Boolean);
  const unknown = groups.filter((g) => !Object.hasOwn(CATEGORY_GROUPS, g));
  if (unknown.length > 0) throw new Error(`Unknown LEAD_TARGET_CATEGORIES: ${unknown.join(", ")}`);
  return groups as CategoryGroup[];
}

export interface ScoreInput {
  webPresence: WebPresence;
  hasInstagram: boolean;
  phoneCount: number;
  category: string | null;
  confidence: number | null;
  chainSize: number;
  /** When the source last updated the place (Foursquare), YYYY-MM-DD. */
  refreshedOn?: string | null;
  /** Reference date for refreshedOn (defaults to now). */
  today?: string;
}

function monthsBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

export interface ScorePart {
  label: string;
  points: number;
}

/** Explains a score as labelled parts. The score is their sum, 0 to 90. */
export function scoreParts(input: ScoreInput, targets: CategoryGroup[] = DEFAULT_TARGET_GROUPS): ScorePart[] {
  if (input.webPresence === "possibly_closed") return [{ label: "Possibly closed", points: 0 }];
  if (input.chainSize >= CHAIN_MIN_LOCATIONS) {
    return [{ label: `Chain (${input.chainSize} locations)`, points: 5 }];
  }

  const parts: ScorePart[] = [];
  const presencePoints: Record<WebPresence, number> = {
    no_website_listed: 35,
    social_only: 30,
    website_listed: 10,
    possibly_closed: 0,
  };
  const presenceLabels: Record<WebPresence, string> = {
    no_website_listed: "No website listed",
    social_only: "Social media only",
    website_listed: "Has a website (upgrade lead)",
    possibly_closed: "Possibly closed",
  };
  parts.push({ label: presenceLabels[input.webPresence], points: presencePoints[input.webPresence] });

  if (input.phoneCount > 0) parts.push({ label: "Phone number listed", points: 15 });
  if (input.hasInstagram) parts.push({ label: "Active on Instagram", points: 10 });

  const targeted = input.category !== null && targets.some((g) => (CATEGORY_GROUPS[g].categories as readonly string[]).includes(input.category!));
  if (targeted) parts.push({ label: "Target category", points: 15 });

  const c = input.confidence;
  if (c !== null) {
    const points = c >= 0.9 ? 15 : c >= 0.7 ? 10 : c >= 0.5 ? 5 : 0;
    if (points > 0) parts.push({ label: `Likely still exists (${Math.round(c * 100)}%)`, points });
  } else if (input.refreshedOn) {
    // Foursquare has no existence score; recent updates are the next best signal.
    const months = monthsBetween(input.refreshedOn, input.today ?? new Date().toISOString().slice(0, 10));
    if (months <= 12) parts.push({ label: "Updated in the last year", points: 10 });
    else if (months <= 24) parts.push({ label: "Updated in the last 2 years", points: 5 });
  } else {
    parts.push({ label: "Existence not scored", points: 5 });
  }
  return parts;
}

export function scorePlace(input: ScoreInput, targets?: CategoryGroup[]): number {
  return Math.min(100, scoreParts(input, targets).reduce((sum, part) => sum + part.points, 0));
}

/** Bonus for a saved lead whose website review found opportunities (max 10). */
export function reviewBonus(opportunityCount: number): number {
  return Math.min(10, opportunityCount * 3);
}

/**
 * Name keys for chain grouping: the whole normalized name, plus its Latin-only
 * and Arabic-only parts, so "بيتزا هت | Pizza Hut" groups with "Pizza Hut".
 */
export function chainKeys(name: string | null): string[] {
  if (!name) return [];
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[ً-ْـ]/g, "") // Arabic diacritics and tatweel
      .replace(/[إأآ]/g, "ا")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const whole = normalize(name);
  const latin = normalize(name.replace(/[^A-Za-z0-9\s]/g, " "));
  const arabic = normalize(name.replace(/[^؀-ۿ\s]/g, " "));
  return [...new Set([whole, latin, arabic].filter((k) => k.length >= 3))];
}

/** Number of places in the same area sharing a name key, per place index. */
export function computeChainSizes(names: (string | null)[]): number[] {
  const counts = new Map<string, number>();
  const keysPerPlace = names.map(chainKeys);
  for (const keys of keysPerPlace) for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return keysPerPlace.map((keys) => Math.max(1, ...keys.map((k) => counts.get(k) ?? 1)));
}
