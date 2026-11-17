// Decides, from a Gmail thread's message metadata, whether the business
// replied. Only the From and Auto-Submitted headers and Gmail's labels are read.

export interface ThreadMessageMeta {
  labelIds?: string[];
  /** When Gmail received the message, ms since 1970, as a string. */
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
}

export interface ThreadStatus {
  /** The operator sent at least one message in this conversation. */
  sent: boolean;
  /** Someone else wrote back (not an automatic reply or a bounce). */
  replied: boolean;
  /** When the latest reply arrived (ms), if known. */
  lastReplyAt: number | null;
}

function header(message: ThreadMessageMeta, name: string): string | null {
  const found = message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found ? found.value : null;
}

/** The bare address from a From header, lowercased, without a +tag. */
export function fromAddress(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/<([^<>\s]+@[^<>\s]+)>/) ?? value.match(/([^\s<>"',;]+@[^\s<>"',;]+)/);
  if (!match) return null;
  const address = match[1].toLowerCase();
  const at = address.lastIndexOf("@");
  return `${address.slice(0, at).split("+")[0]}${address.slice(at)}`;
}

const SYSTEM_SENDERS = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/;

export function threadStatus(messages: ThreadMessageMeta[], ownEmail: string): ThreadStatus {
  const own = fromAddress(ownEmail);
  let sent = false;
  let replied = false;
  let lastReplyAt: number | null = null;
  for (const message of messages) {
    const labels = message.labelIds ?? [];
    if (labels.includes("DRAFT")) continue;
    if (labels.includes("SENT")) {
      sent = true;
      continue;
    }
    const from = fromAddress(header(message, "From"));
    if (!from || from === own || SYSTEM_SENDERS.test(from)) continue;
    const autoSubmitted = header(message, "Auto-Submitted");
    if (autoSubmitted && autoSubmitted.trim().toLowerCase() !== "no") continue;
    replied = true;
    const at = Number(message.internalDate);
    if (Number.isFinite(at) && at > 0 && (lastReplyAt === null || at > lastReplyAt)) lastReplyAt = at;
  }
  // A reply only counts once the operator actually sent the first message.
  return sent && replied ? { sent, replied: true, lastReplyAt } : { sent, replied: false, lastReplyAt: null };
}
