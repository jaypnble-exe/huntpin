"use client";

import { useState } from "react";
import { Button, IconMail, InlineMessage } from "@/components/ui";

interface Result {
  checked: number;
  sent: number;
  replies: { leadId: string | null; name: string | null; updated: boolean }[];
}

function summary(result: Result): string {
  if (result.checked === 0) return "No emails to recently contacted leads found in your Sent mail.";
  const labelled = `${result.sent} sent ${result.sent === 1 ? "conversation" : "conversations"} under HUNTPIN`;
  const updated = result.replies.filter((r) => r.updated);
  const names = updated.map((r) => r.name).filter(Boolean).slice(0, 3).join(", ");
  if (result.replies.length === 0) return `${labelled}; no new replies.`;
  return `${labelled}; ${result.replies.length} new ${result.replies.length === 1 ? "reply" : "replies"}${
    updated.length > 0 ? `; marked Replied: ${names}${updated.length > 3 ? "…" : ""}` : ""
  }.`;
}

/** Operator-clicked: labels sent outreach HUNTPIN in Gmail and checks for replies. */
export function GmailReplyCheck({ onUpdated }: { onUpdated?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/gmail/replies", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? "Gmail could not be checked.");
      const result = body as Result;
      setMessage({ tone: "success", text: summary(result) });
      if (result.replies.length > 0) onUpdated?.();
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Gmail could not be checked." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button onClick={run} disabled={busy} title="Puts emails you sent to leads under the HUNTPIN label and checks them for replies">
        <IconMail />
        {busy ? "Syncing with Gmail…" : "Sync with Gmail"}
      </Button>
      {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}
    </span>
  );
}
