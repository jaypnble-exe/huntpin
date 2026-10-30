// Batch website review: which saved leads to check, and how gently.
// Operator-triggered only, capped, and spaced out (see CLAUDE.md).

export const BATCH_REVIEW_MAX = 20;
/** Gap between checks; keeps under the server's 10 checks/minute limit. */
export const BATCH_REVIEW_INTERVAL_MS = 7000;
/** Leads checked more recently than this are skipped. */
export const RECHECK_AFTER_DAYS = 30;

export interface BatchCandidate {
  id: string;
  url: string;
}

export function pickBatchCandidates(
  leads: { id: string; lead_status: string; website_checked_at: string | null; url: string }[],
  now: Date,
): BatchCandidate[] {
  const cutoff = now.getTime() - RECHECK_AFTER_DAYS * 24 * 60 * 60 * 1000;
  return leads
    .filter((lead) => lead.url && lead.lead_status !== "not_interested" && lead.lead_status !== "do_not_contact" && lead.lead_status !== "not_a_fit")
    .filter((lead) => !lead.website_checked_at || new Date(lead.website_checked_at).getTime() < cutoff)
    .slice(0, BATCH_REVIEW_MAX)
    .map(({ id, url }) => ({ id, url }));
}
