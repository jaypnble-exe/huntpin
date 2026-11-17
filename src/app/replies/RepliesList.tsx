"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LeadStatusBadge } from "@/components/leads/LeadBadges";
import { Alert, Card, EmptyState, ExternalButtonLink, IconExternal, PageHeader, Spinner, buttonClasses } from "@/components/ui";
import { isLeadStatus } from "@/lib/leads/leads";
import { GmailReplyCheck } from "../leads/GmailReplyCheck";
import { useGmailStatus } from "../leads/useGmailStatus";

interface Reply {
  threadId: string;
  repliedAt: string;
  placeId: string;
  name: string | null;
  lead: { id: string; label: string | null; status: string } | null;
  url: string;
}

type LoadState = { kind: "loading" } | { kind: "ready"; replies: Reply[]; lastSyncAt: string | null } | { kind: "error"; message: string };

function formatWhen(value: string): string {
  return new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function RepliesList() {
  const [gmail] = useGmailStatus();
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });

  const reload = useCallback(() => {
    fetch("/api/gmail/replies")
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.message ?? "Replies are unavailable.");
        setLoad({ kind: "ready", replies: body.replies as Reply[], lastSyncAt: body.lastSyncAt ?? null });
      })
      .catch((error: unknown) => setLoad({ kind: "error", message: error instanceof Error ? error.message : "Replies are unavailable." }));
  }, []);

  useEffect(reload, [reload]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Replies"
        description="Businesses that wrote back to your outreach emails. Open a conversation to read and answer it in Gmail."
        actions={gmail.connected ? <GmailReplyCheck onUpdated={reload} /> : undefined}
      />

      <div className="mt-4" aria-live="polite">
        {load.kind === "loading" && <Spinner label="Loading replies…" />}
        {load.kind === "error" && (
          <Alert tone="warning">
            {load.message}{" "}
            <Link href="/templates" className="font-medium underline">
              Gmail settings
            </Link>
          </Alert>
        )}
      </div>

      {load.kind === "ready" && (
        <>
          <p className="mt-2 text-xs text-muted">
            {load.lastSyncAt ? `Last synced ${formatWhen(load.lastSyncAt)}.` : "Not synced yet."} New replies appear after Sync with
            Gmail. WhatsApp replies aren’t included.
          </p>

          {load.replies.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No replies yet" description="Press Sync with Gmail after sending emails to check for replies." />
            </div>
          ) : (
            <Card className="mt-4">
              <ul className="divide-y divide-border">
                {load.replies.map((reply) => {
                  const name = reply.lead?.label?.trim() || reply.name || "Unnamed business";
                  return (
                    <li key={reply.threadId} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium" dir="auto">
                          {name}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span>Replied {formatWhen(reply.repliedAt)}</span>
                          {reply.lead && isLeadStatus(reply.lead.status) && <LeadStatusBadge status={reply.lead.status} />}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {reply.lead && (
                          <Link href={`/leads?lead=${reply.lead.id}`} className={buttonClasses({ size: "sm" })}>
                            Open lead
                          </Link>
                        )}
                        <ExternalButtonLink size="sm" variant="primary" href={reply.url}>
                          <IconExternal />
                          Open in Gmail
                        </ExternalButtonLink>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
