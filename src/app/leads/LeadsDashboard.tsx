"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { InstagramBadge, LeadStatusBadge, PresenceBadge, ScorePill, WebsiteStatusBadge } from "@/components/leads/LeadBadges";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  IconBell,
  IconDownload,
  PageHeader,
  Select,
  Spinner,
  Stat,
  Alert,
  buttonClasses,
  cn,
} from "@/components/ui";
import { isDue, localDate, wantsFollowUp } from "@/lib/leads/followUps";
import { LEAD_STATUS_LABELS, LEAD_STATUSES } from "@/lib/leads/leads";
import { CATEGORY_GROUPS, humanizeCategory, isCategoryGroup } from "@/lib/places/categories";
import { reviewBonus } from "@/lib/places/leadScore";
import { WEB_PRESENCE } from "@/lib/places/webPresence";
import type { Lead } from "@/lib/server/leadsStore";
import { PRESENCE_STYLES } from "../placeStyles";
import { BatchReview } from "./BatchReview";
import { LeadEditor } from "./LeadEditor";
import { leadOpportunities } from "./WebsiteCheck";

/** Place score plus a bonus for website-review opportunities, capped at 100. */
function leadScore(lead: Lead): number {
  return Math.min(100, (lead.place?.lead_score ?? 0) + reviewBonus(leadOpportunities(lead).length));
}

type LoadState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";
}

function FollowUpCell({ lead, today }: { lead: Lead; today: string }) {
  if (!lead.follow_up_on || !wantsFollowUp(lead.lead_status)) return <span className="text-muted">—</span>;
  const due = isDue(lead.follow_up_on, lead.lead_status, today);
  const text =
    lead.follow_up_on === today ? "Today" : lead.follow_up_on < today ? `Overdue · ${formatDate(lead.follow_up_on)}` : formatDate(lead.follow_up_on);
  return <span className={cn("whitespace-nowrap", due && "font-semibold text-danger")}>{text}</span>;
}

export function LeadsDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("lead");

  const [status, setStatus] = useState("");
  const [presence, setPresence] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"score" | "updated">("score");
  const [dueOnly, setDueOnly] = useState(false);
  const today = localDate(new Date());
  const [leads, setLeads] = useState<Lead[]>([]);
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (presence) q.set("presence", presence);
    if (category) q.set("category", category);
    if (dueOnly) q.set("due", "1");
    return q.toString();
  }, [status, presence, category, dueOnly]);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ kind: "loading" });
    fetch(`/api/leads?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message ?? "Leads could not be loaded.");
        setLeads(body.leads as Lead[]);
        setLoad({ kind: "ready" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoad({ kind: "error", message: error instanceof Error ? error.message : "Leads could not be loaded." });
      });
    return () => controller.abort();
  }, [query]);

  const sorted = useMemo(
    () => (sort === "score" ? [...leads].sort((a, b) => leadScore(b) - leadScore(a)) : leads),
    [leads, sort],
  );

  const dueCount = leads.filter((lead) => isDue(lead.follow_up_on, lead.lead_status, today)).length;
  const contactedCount = leads.filter((lead) => lead.first_contacted_at).length;
  const repliedCount = leads.filter((lead) => lead.lead_status === "replied").length;
  const selected = leads.find((lead) => lead.id === selectedId) ?? null;
  const select = (id: string | null) => router.replace(id ? `/leads?lead=${id}` : "/leads", { scroll: false });
  const updateLead = (lead: Lead) => setLeads((all) => all.map((l) => (l.id === lead.id ? lead : l)));
  const filtersActive = Boolean(status || presence || category || dueOnly);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Leads"
        description="Businesses you saved from the map. Track status, contact dates and follow-ups here."
        actions={
          <>
            <BatchReview leads={sorted} onUpdated={updateLead} />
            <a href={`/api/leads/export?${query}`} download className={buttonClasses({ variant: "secondary" })}>
              <IconDownload />
              Export CSV
            </a>
          </>
        }
      />

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Leads" value={leads.length} hint={filtersActive ? "matching filters" : "saved"} />
        <Stat label="Contacted" value={contactedCount} />
        <Stat label="Replied" value={repliedCount} tone={repliedCount > 0 ? "success" : undefined} />
        <Stat label="Follow-ups due" value={dueCount} tone={dueCount > 0 ? "danger" : undefined} />
      </dl>

      <Card className="mt-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Web presence">
            <Select value={presence} onChange={(e) => setPresence(e.target.value)}>
              <option value="">Any</option>
              {WEB_PRESENCE.map((p) => (
                <option key={p} value={p}>
                  {PRESENCE_STYLES[p].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(isCategoryGroup(e.target.value) ? e.target.value : "")}>
              <option value="">All categories</option>
              {Object.entries(CATEGORY_GROUPS).map(([key, group]) => (
                <option key={key} value={key}>
                  {group.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sort">
            <Select value={sort} onChange={(e) => setSort(e.target.value === "updated" ? "updated" : "score")}>
              <option value="score">Best leads first</option>
              <option value="updated">Recently updated</option>
            </Select>
          </Field>
          <Button
            variant={dueOnly ? "primary" : "secondary"}
            aria-pressed={dueOnly}
            onClick={() => setDueOnly((d) => !d)}
          >
            <IconBell />
            {dueOnly ? "Showing due only" : `Follow-ups due${dueCount > 0 ? ` (${dueCount})` : ""}`}
          </Button>
        </div>
      </Card>

      <div aria-live="polite" className="mt-6">
        {load.kind === "loading" && <Spinner label="Loading leads…" />}
        {load.kind === "error" && <Alert tone="danger">{load.message}</Alert>}
        {load.kind === "ready" && leads.length === 0 && (
          <EmptyState
            title={dueOnly ? "No follow-ups due today" : filtersActive ? "No leads match these filters" : "No leads yet"}
            description={
              dueOnly
                ? "Nice. Leads you contact get a reminder 4 days later."
                : filtersActive
                  ? "Try clearing a filter."
                  : "Open the map, click a business and choose Save as lead."
            }
            action={!filtersActive ? <ButtonLink href="/" variant="primary">Open the map</ButtonLink> : undefined}
          />
        )}
      </div>

      {load.kind === "ready" && leads.length > 0 && (
        <Card className="mt-2 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Saved leads. Select a business to open it.</caption>
              <thead className="border-b border-border bg-surface-muted text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2.5">Score</th>
                  <th scope="col" className="px-4 py-2.5">Business</th>
                  <th scope="col" className="px-4 py-2.5">Web presence</th>
                  <th scope="col" className="px-4 py-2.5">Status</th>
                  <th scope="col" className="px-4 py-2.5">Website</th>
                  <th scope="col" className="px-4 py-2.5">Last contact</th>
                  <th scope="col" className="px-4 py-2.5">Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => select(lead.id)}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-surface-muted",
                      lead.id === selectedId && "bg-info-soft hover:bg-info-soft",
                    )}
                  >
                    <td className="px-4 py-3">
                      <ScorePill score={leadScore(lead)} />
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          select(lead.id);
                        }}
                        className="block max-w-full truncate text-left font-medium hover:underline"
                      >
                        <bdi>{lead.label ?? lead.place?.name ?? "Unnamed"}</bdi>
                      </button>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        {humanizeCategory(lead.place?.basic_category ?? null)}
                        {lead.place?.has_instagram && <InstagramBadge />}
                      </span>
                    </td>
                    <td className="px-4 py-3">{lead.place && <PresenceBadge presence={lead.place.web_presence} />}</td>
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={lead.lead_status} />
                    </td>
                    <td className="px-4 py-3">
                      <WebsiteStatusBadge status={lead.website_status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(lead.last_contacted_at)}</td>
                    <td className="px-4 py-3">
                      <FollowUpCell lead={lead} today={today} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leads.length >= 1000 && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted">Showing the 1,000 most recently updated leads.</p>
          )}
        </Card>
      )}

      {selected && (
        <LeadEditor
          key={selected.id}
          lead={selected}
          onClose={() => select(null)}
          onSaved={updateLead}
          onDeleted={(id) => {
            setLeads((all) => all.filter((l) => l.id !== id));
            select(null);
          }}
        />
      )}
    </main>
  );
}
