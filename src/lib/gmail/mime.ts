// Builds the raw email for a Gmail draft (RFC 5322, plain text, UTF-8).
// The operator reviews and sends the draft themselves in Gmail.

import { normalizeEmails } from "../places/emails";

export const MAX_DRAFT_SUBJECT_LENGTH = 150;
export const MAX_DRAFT_BODY_LENGTH = 10_000;

export interface DraftMessage {
  to: string;
  /** The operator's own (plus) address, so their Gmail filter labels the conversation. */
  bcc?: string | null;
  subject: string;
  body: string;
}

/** Header values never contain line breaks (no header injection). */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** RFC 2047 encoded words for non-ASCII text, each at most 45 bytes of UTF-8. */
export function encodeHeaderValue(value: string): string {
  const text = oneLine(value);
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  const words: string[] = [];
  let chunk = "";
  for (const char of Array.from(text)) {
    if (Buffer.byteLength(chunk + char, "utf8") > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += char;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, "utf8").toString("base64")}?=`).join("\r\n ");
}

function wrap(base64: string): string {
  return base64.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

/** The message as Gmail's API wants it: base64url of the whole RFC 5322 text. */
export function buildRawMessage(message: DraftMessage): string {
  const [to] = normalizeEmails([message.to]);
  if (!to) throw new Error("invalid_recipient");
  const [bcc] = normalizeEmails(message.bcc ? [message.bcc] : []);
  const subject = oneLine(message.subject).slice(0, MAX_DRAFT_SUBJECT_LENGTH);
  const body = message.body.slice(0, MAX_DRAFT_BODY_LENGTH).replace(/\r?\n/g, "\r\n");

  const headers = [
    `To: ${to}`,
    ...(bcc && bcc !== to ? [`Bcc: ${bcc}`] : []),
    `Subject: ${encodeHeaderValue(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  const raw = `${headers.join("\r\n")}\r\n\r\n${wrap(Buffer.from(body, "utf8").toString("base64"))}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}
