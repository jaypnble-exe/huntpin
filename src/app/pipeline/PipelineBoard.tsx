"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  InlineMessage,
  PageHeader,
  Spinner,
  Stat,
  cn,
} from "@/components/ui";
import { DEAL_CURRENCY, DEAL_STAGES, LEAD_STATUS_LABELS, type DealStage } from "@/lib/leads/leads";
import { computePipelineStats, daysSince, formatMoney, neighbourStages } from "@/lib/leads/pipeline";
import { humanizeCategory } from "@/lib/places/categories";
import type { Lead } from "@/lib/server/leadsStore";
import { LeadEditor } from "../leads/LeadEditor";

type LoadState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

const STAGE_HINTS: Record<DealStage, string> = {
  replied: "They answered. Arrange a call or meeting.",
  meeting: "Call or meeting planned or done.",
  proposal_sent: "Quote or proposal sent; waiting for a decision.",
  won: "Agreed. Nice work.",
  lost: "Said no after talking. No more messages.",
};

const STAGE_ACCENTS: Record<DealStage, string> = {
  replied: "border-t-success",
  meeting: "border-t-info",
  proposal_sent: "border-t-pink",
  won: "border-t-primary",
  lost: "border-t-border-strong",
};

export function PipelineBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("lead");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leads?status=${DEAL_STAGES.join(",")}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message ?? "The pipeline could not be loaded.");
        setLeads(body.leads as Lead[]);
        setLoad({ kind: "ready" });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoad({ kind: "error", message: err instanceof Error ? err.message : "The pipeline could not be loaded." });
      });
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => computePipelineStats(leads, new Date()), [leads]);
  const columns = useMemo(
    () =>
      Object.fromEntries(
        DEAL_STAGES.map((stage) => [
          stage,
          leads
            .filter((lead) => lead.lead_status === stage)
            .sort((a, b) => (a.status_changed_at < b.status_changed_at ? 1 : -1)),
        ]),
      ) as Record<DealStage, Lead[]>,
    [leads],
  );

  const select = (id: string | null) => router.replace(id ? `/pipeline?lead=${id}` : "/pipeline", { scroll: false });
  const replace = (lead: Lead) => setLeads((all) => all.map((l) => (l.id === lead.id ? lead : l)));
  const selected = leads.find((lead) => lead.id === selectedId) ?? null;

  async function move(lead: Lead, stage: DealStage) {
    setBusyId(lead.id);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: stage }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "Could not move the deal.");
      replace(body.lead as Lead);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move the deal.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6">
      <PageHeader
        title="Pipeline"
        description="Leads that replied, through to won or lost. Open a card to set the deal value or add notes."
        actions={<ButtonLink href="/queue">Outreach queue</ButtonLink>}
      />

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open deals" value={formatMoney(stats.openValue, DEAL_CURRENCY)} hint={`${stats.openCount} in progress`} />
        <Stat
          label="Won this month"
          value={formatMoney(stats.wonThisMonthValue, DEAL_CURRENCY)}
          hint={`${stats.wonThisMonthCount} deal${stats.wonThisMonthCount === 1 ? "" : "s"}`}
          tone={stats.wonThisMonthCount > 0 ? "success" : undefined}
        />
        <Stat label="Won in total" value={formatMoney(stats.wonValue, DEAL_CURRENCY)} hint={`${stats.wonCount} deals`} />
        <Stat
          label="Win rate"
          value={stats.winRate === null ? "—" : `${Math.round(stats.winRate * 100)}%`}
          hint={`${stats.wonCount} won · ${stats.lostCount} lost`}
        />
      </dl>

      <div aria-live="polite" className="mt-6">
        {load.kind === "loading" && <Spinner label="Loading the pipeline…" />}
        {load.kind === "error" && <Alert tone="danger">{load.message}</Alert>}
        {error && <InlineMessage tone="danger">{error}</InlineMessage>}
        {load.kind === "ready" && leads.length === 0 && (
          <EmptyState
            title="No replies yet"
            description="When a business answers, set its status to Replied (or press “They replied” in the queue). It appears here."
            action={<ButtonLink href="/queue" variant="primary">Start outreach</ButtonLink>}
          />
        )}
      </div>

      {load.kind === "ready" && leads.length > 0 && (
        <div className="mt-2 grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
          {DEAL_STAGES.map((stage) => {
            const cards = columns[stage];
            const total = cards.reduce((sum, lead) => sum + (lead.deal_value ?? 0), 0);
            return (
              <section
                key={stage}
                aria-labelledby={`stage-${stage}`}
                className={cn("flex min-h-40 flex-col rounded-xl border border-t-4 border-border bg-surface-muted/60", STAGE_ACCENTS[stage])}
              >
                <header className="px-3 pt-3 pb-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 id={`stage-${stage}`} className="text-sm font-semibold">
                      {LEAD_STATUS_LABELS[stage]} <span className="font-normal text-muted">({cards.length})</span>
                    </h2>
                    {total > 0 && <span className="text-xs text-muted tabular-nums">{formatMoney(total, DEAL_CURRENCY)}</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{STAGE_HINTS[stage]}</p>
                </header>
                <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
                  {cards.map((lead) => {
                    const { previous, next } = neighbourStages(stage);
                    const days = daysSince(lead.status_changed_at, now);
                    return (
                      <li key={lead.id}>
                        <Card className={cn("p-3", lead.id === selectedId && "ring-2 ring-primary/40")}>
                          <button
                            type="button"
                            onClick={() => select(lead.id)}
                            className="block w-full text-left"
                          >
                            <span className="block truncate text-sm font-medium hover:underline" dir="auto">
                              {lead.label ?? lead.place?.name ?? "Unnamed"}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">
                              {humanizeCategory(lead.place?.basic_category ?? null)}
                            </span>
                            <span className="mt-2 flex items-center justify-between gap-2 text-xs">
                              <span className={cn("font-semibold tabular-nums", lead.deal_value === null && "font-normal text-muted")}>
                                {lead.deal_value === null ? "No value yet" : formatMoney(lead.deal_value, DEAL_CURRENCY)}
                              </span>
                              <span className="text-muted">{days === 0 ? "today" : `${days}d in stage`}</span>
                            </span>
                          </button>
                          {(previous || next.length > 0) && (
                            <div className="mt-2 flex flex-wrap gap-1 border-t border-border pt-2">
                              {previous && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busyId === lead.id}
                                  onClick={() => move(lead, previous)}
                                  aria-label={`Move back to ${LEAD_STATUS_LABELS[previous]}`}
                                >
                                  ←
                                </Button>
                              )}
                              {next.map((target) => (
                                <Button
                                  key={target}
                                  size="sm"
                                  variant={target === "lost" ? "ghost" : "secondary"}
                                  disabled={busyId === lead.id}
                                  onClick={() => move(lead, target)}
                                >
                                  {LEAD_STATUS_LABELS[target]} {target !== "lost" && "→"}
                                </Button>
                              ))}
                            </div>
                          )}
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {selected && (
        <LeadEditor
          key={selected.id}
          lead={selected}
          onClose={() => select(null)}
          onSaved={replace}
          onDeleted={(id) => {
            setLeads((all) => all.filter((l) => l.id !== id));
            select(null);
          }}
        />
      )}
    </main>
  );
}
