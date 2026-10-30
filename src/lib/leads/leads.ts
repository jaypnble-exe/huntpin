// Lead statuses and edit validation, shared by the browser and the server.
// Everything here is app-created data entered by the operator.

export const LEAD_STATUSES = [
  "new",
  "reviewed",
  "contacted",
  "replied",
  "follow_up",
  // Deal stages after a reply.
  "meeting",
  "proposal_sent",
  "won",
  "lost",
  "not_interested",
  "do_not_contact",
  // Not a prospect (e.g. already has a good website). Hidden from the map.
  "not_a_fit",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  contacted: "Contacted",
  replied: "Replied",
  follow_up: "Follow up",
  meeting: "Meeting",
  proposal_sent: "Proposal sent",
  won: "Won",
  lost: "Lost",
  not_interested: "Not interested",
  do_not_contact: "Do not contact",
  not_a_fit: "Not a fit",
};

/** Pipeline columns: a reply, then the deal stages. */
export const DEAL_STAGES = ["replied", "meeting", "proposal_sent", "won", "lost"] as const satisfies readonly LeadStatus[];
export type DealStage = (typeof DEAL_STAGES)[number];

export function isDealStage(status: LeadStatus): status is DealStage {
  return (DEAL_STAGES as readonly string[]).includes(status);
}

/** Deal values are in this currency. */
export const DEAL_CURRENCY = "SAR";
export const MAX_DEAL_VALUE = 9_999_999;

export const MAX_LABEL_LENGTH = 120;
export const MAX_NOTES_LENGTH = 2000;

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

/** Outreach drafts are never offered for leads that declined, opted out, or whose deal is closed. */
export function canDraftOutreach(status: LeadStatus): boolean {
  return !(["not_interested", "do_not_contact", "not_a_fit", "won", "lost"] as LeadStatus[]).includes(status);
}

export interface LeadPatch {
  label?: string | null;
  operator_notes?: string | null;
  lead_status?: LeadStatus;
  first_contacted_at?: string | null;
  last_contacted_at?: string | null;
  confirmed_opportunities?: string[];
  follow_up_on?: string | null;
  follow_up_count?: number;
  deal_value?: number | null;
}

export type ParsedLeadPatch =
  | { ok: true; patch: LeadPatch; markContacted: boolean }
  | { ok: false; error: string };

const ALLOWED_KEYS = new Set([
  "label",
  "notes",
  "status",
  "firstContactedOn",
  "lastContactedOn",
  "markContacted",
  "confirmedOpportunities",
  "followUpOn",
  "dealValue",
]);
const OPPORTUNITY_KEY = /^[a-z_]{1,40}$/;
export const MAX_CONFIRMED_OPPORTUNITIES = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function optionalText(value: unknown, name: string, max: number): string | null | Error {
  if (value === null) return null;
  if (typeof value !== "string") return new Error(`${name} must be a string or null`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return new Error(`${name} contains invalid characters`);
  const text = value.trim();
  if (text.length > max) return new Error(`${name} must be at most ${max} characters`);
  return text === "" ? null : text;
}

function optionalDate(value: unknown, name: string): string | null | Error {
  if (value === null) return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return new Error(`${name} must be YYYY-MM-DD or null`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return new Error(`${name} is not a real date`);
  }
  return date.toISOString();
}

/** Validates a lead edit from the browser. Unknown fields are rejected. */
export function parseLeadPatch(body: unknown): ParsedLeadPatch {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ALLOWED_KEYS.has(key))) {
    return { ok: false, error: "Request contains unsupported fields" };
  }

  const patch: LeadPatch = {};
  const fields: [string, (v: unknown) => string | null | Error, keyof LeadPatch][] = [
    ["label", (v) => optionalText(v, "label", MAX_LABEL_LENGTH), "label"],
    ["notes", (v) => optionalText(v, "notes", MAX_NOTES_LENGTH), "operator_notes"],
    ["firstContactedOn", (v) => optionalDate(v, "firstContactedOn"), "first_contacted_at"],
    ["lastContactedOn", (v) => optionalDate(v, "lastContactedOn"), "last_contacted_at"],
  ];
  for (const [key, parse, column] of fields) {
    if (!(key in record)) continue;
    const value = parse(record[key]);
    if (value instanceof Error) return { ok: false, error: value.message };
    (patch as Record<string, string | null>)[column] = value;
  }

  if ("status" in record) {
    if (!isLeadStatus(record.status)) return { ok: false, error: "status is not a valid lead status" };
    patch.lead_status = record.status;
  }

  if ("followUpOn" in record) {
    const value = record.followUpOn;
    if (value !== null && (typeof value !== "string" || !DATE_PATTERN.test(value) || optionalDate(value, "followUpOn") instanceof Error)) {
      return { ok: false, error: "followUpOn must be YYYY-MM-DD or null" };
    }
    patch.follow_up_on = value as string | null;
  }

  if ("confirmedOpportunities" in record) {
    const keys = record.confirmedOpportunities;
    if (
      !Array.isArray(keys) ||
      keys.length > MAX_CONFIRMED_OPPORTUNITIES ||
      !keys.every((k) => typeof k === "string" && OPPORTUNITY_KEY.test(k))
    ) {
      return { ok: false, error: "confirmedOpportunities must be a short list of opportunity keys" };
    }
    patch.confirmed_opportunities = [...new Set(keys as string[])];
  }

  if ("dealValue" in record) {
    const value = record.dealValue;
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_DEAL_VALUE)) {
      return { ok: false, error: `dealValue must be a number from 0 to ${MAX_DEAL_VALUE}, or null` };
    }
    patch.deal_value = value === null ? null : Math.round(value * 100) / 100;
  }

  if ("markContacted" in record && typeof record.markContacted !== "boolean") {
    return { ok: false, error: "markContacted must be a boolean" };
  }
  const markContacted = record.markContacted === true;

  if (Object.keys(patch).length === 0 && !markContacted) return { ok: false, error: "Nothing to update" };
  return { ok: true, patch, markContacted };
}
