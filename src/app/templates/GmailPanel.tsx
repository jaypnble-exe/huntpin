"use client";

import { useState } from "react";
import { Alert, Button, Card, IconMail, InlineMessage, Section, buttonClasses } from "@/components/ui";
import { GmailReplyCheck } from "../leads/GmailReplyCheck";
import { useGmailStatus } from "../leads/useGmailStatus";

const OUTCOMES: Record<string, { tone: "success" | "danger"; text: string }> = {
  connected: { tone: "success", text: "Gmail connected. Drafts now get a “Gmail draft” button." },
  denied: { tone: "danger", text: "Gmail wasn't connected: access was declined on Google's screen." },
  scope_missing: { tone: "danger", text: "Gmail wasn't connected: tick the Gmail permission on Google's screen and try again." },
  expired: { tone: "danger", text: "The connect link expired. Press Connect Gmail again." },
  not_configured: { tone: "danger", text: "Gmail isn't set up on this server yet (see docs/GMAIL.md)." },
  failed: { tone: "danger", text: "Gmail couldn't be connected. Check the setup in docs/GMAIL.md and try again." },
};

function formatWhen(value: string | null | undefined): string | null {
  return value ? new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
}

export function GmailPanel({ outcome }: { outcome: string | null }) {
  const [gmail, refresh] = useGmailStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notice = outcome ? OUTCOMES[outcome] : undefined;

  async function disconnect() {
    if (!window.confirm("Disconnect Gmail? HuntPin's access is revoked; drafts already in Gmail stay there.")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/gmail", { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Could not disconnect.");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <Section
        title="Gmail"
        description="Optional. HuntPin puts drafts in your Gmail labelled HUNTPIN and checks them for replies. It never sends: you press Send in Gmail."
      >
        <div className="space-y-3 text-sm">
          {notice && <InlineMessage tone={notice.tone}>{notice.text}</InlineMessage>}
          {gmail.problem && <Alert tone="warning">{gmail.problem}</Alert>}

          {gmail.connected ? (
            <>
              <p>
                Connected as <strong dir="ltr">{gmail.email}</strong>
                {gmail.lastReplyCheckAt && <span className="text-muted"> · replies last checked {formatWhen(gmail.lastReplyCheckAt)}</span>}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <GmailReplyCheck onUpdated={refresh} />
                <Button variant="ghost" onClick={disconnect} disabled={busy}>
                  Disconnect
                </Button>
              </div>
            </>
          ) : gmail.configured ? (
            <a href="/api/gmail/connect" className={buttonClasses({ variant: "primary" })}>
              <IconMail />
              Connect Gmail
            </a>
          ) : (
            <p className="text-muted">Not set up on this server. Follow docs/GMAIL.md to add the Google sign-in settings.</p>
          )}
          {error && <InlineMessage tone="danger">{error}</InlineMessage>}

          {gmail.bcc ? (
            <div className="rounded-lg bg-surface-muted px-3 py-2">
              <p>
                Every outreach email gets a BCC to <strong dir="ltr">{gmail.bcc}</strong>. To file them under HUNTPIN, create one
                Gmail filter (Settings → Filters → Create a new filter):
              </p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                <li>
                  To: <span dir="ltr">{gmail.bcc}</span>
                </li>
                <li>Apply the label: HUNTPIN (and tick “Skip the Inbox”)</li>
              </ol>
            </div>
          ) : (
            <p className="text-muted">
              Set OUTREACH_BCC (e.g. you+huntpin@gmail.com) or connect Gmail to BCC yourself on every outreach email.
            </p>
          )}
        </div>
      </Section>
    </Card>
  );
}
