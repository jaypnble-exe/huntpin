import { isCategoryGroup, type CategoryGroup } from "../places/categories";
import { WEB_PRESENCE, type WebPresence } from "../places/webPresence";
import { isLeadStatus, type LeadStatus } from "./leads";

export interface ParsedLeadListQuery {
  statuses: LeadStatus[];
  presence: WebPresence[];
  category: CategoryGroup | null;
}

function list(params: URLSearchParams, key: string): string[] {
  return (params.get(key) ?? "").split(",").filter(Boolean);
}

/** Parses leads list filters; unknown values are rejected, not ignored. */
export function parseLeadListQuery(
  params: URLSearchParams,
): { ok: true; query: ParsedLeadListQuery } | { ok: false; error: string } {
  const statuses = list(params, "status");
  if (!statuses.every(isLeadStatus)) return { ok: false, error: "unknown lead status" };
  const presence = list(params, "presence");
  if (!presence.every((p) => (WEB_PRESENCE as readonly string[]).includes(p))) {
    return { ok: false, error: "unknown web presence" };
  }
  const category = params.get("category");
  if (category !== null && category !== "" && !isCategoryGroup(category)) return { ok: false, error: "unknown category" };
  return {
    ok: true,
    query: {
      statuses: statuses as LeadStatus[],
      presence: presence as WebPresence[],
      category: category ? (category as CategoryGroup) : null,
    },
  };
}
