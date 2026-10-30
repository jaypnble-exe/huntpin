// Lead statuses and edit validation, shared by the browser and the server.
// Everything here is app-created data entered by the operator.

export const LEAD_STATUSES = [
  "new",
  "reviewed",
  "contacted",
  "replied",
  "follow_up",
  "not_interested",
  "do_not_contact",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  contacted: "Contacted",
  replied: "Replied",
  follow_up: "Follow up",
  not_interested: "Not interested",
  do_not_contact: "Do not contact",
};

export const MAX_LABEL_LENGTH = 120;
export const MAX_NOTES_LENGTH = 2000;

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

/** Outreach drafts are never offered for leads that declined or opted out. */
export function canDraftOutreach(status: LeadStatus): boolean {
  return status !== "not_interested" && status !== "do_not_contact";
}

export interface LeadPatch {
  label?: string | null;
  operator_notes?: string | null;
  lead_status?: LeadStatus;
  first_contacted_at?: string | null;
  last_contacted_at?: string | null;
}

export type ParsedLeadPatch =
  | { ok: true; patch: LeadPatch; markContacted: boolean }
  | { ok: false; error: string };

const ALLOWED_KEYS = new Set(["label", "notes", "status", "firstContactedOn", "lastContactedOn", "markContacted"]);
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

  if ("markContacted" in record && typeof record.markContacted !== "boolean") {
    return { ok: false, error: "markContacted must be a boolean" };
  }
  const markContacted = record.markContacted === true;

  if (Object.keys(patch).length === 0 && !markContacted) return { ok: false, error: "Nothing to update" };
  return { ok: true, patch, markContacted };
}
