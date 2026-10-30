"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LEAD_STATUS_LABELS, LEAD_STATUSES } from "@/lib/leads/leads";
import { CATEGORY_GROUPS, humanizeCategory, isCategoryGroup } from "@/lib/places/categories";
import { WEB_PRESENCE } from "@/lib/places/webPresence";
import type { Lead } from "@/lib/server/leadsStore";
import { PRESENCE_STYLES } from "../placeStyles";
import { LeadEditor } from "./LeadEditor";
import { leadOpportunities, WEBSITE_STATUS_LABELS } from "./WebsiteCheck";
import { isDue, localDate, wantsFollowUp } from "@/lib/leads/followUps";
import { reviewBonus } from "@/lib/places/leadScore";

/** Place score plus a bonus for website-review opportunities, capped at 100. */
function leadScore(lead: Lead): number {
  return Math.min(100, (lead.place?.lead_score ?? 0) + reviewBonus(leadOpportunities(lead).length));
}

type LoadState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

const selectClass = "mt-1 w-full rounded-md border border-black/20 bg-transparent px-2 py-1.5 dark:border-white/25";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "—";
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
  const selected = leads.find((lead) => lead.id === selectedId) ?? null;
  const select = (id: string | null) => router.replace(id ? `/leads?lead=${id}` : "/leads", { scroll: false });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm opacity-80">Saved from the map. Status, notes and contact dates are yours to manage.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={dueOnly}
            onClick={() => setDueOnly((d) => !d)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${dueOnly ? "border-red-700 bg-red-700 text-white" : "border-current"}`}
          >
            {dueOnly
              ? "Showing follow-ups due · show all"
              : `Follow-ups due${dueCount > 0 ? ` (${dueCount})` : ""}`}
          </button>
          <a
            href={`/api/leads/export?${query}`}
            className="rounded-md border border-current px-3 py-1.5 text-sm font-medium"
            download
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <label className="block text-sm font-medium">
          Lead status
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Web presence
          <select className={selectClass} value={presence} onChange={(e) => setPresence(e.target.value)}>
            <option value="">Any</option>
            {WEB_PRESENCE.map((p) => (
              <option key={p} value={p}>
                {PRESENCE_STYLES[p].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Category
          <select
            className={selectClass}
            value={category}
            onChange={(e) => setCategory(isCategoryGroup(e.target.value) ? e.target.value : "")}
          >
            <option value="">All categories</option>
            {Object.entries(CATEGORY_GROUPS).map(([key, group]) => (
              <option key={key} value={key}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Sort
          <select className={selectClass} value={sort} onChange={(e) => setSort(e.target.value === "updated" ? "updated" : "score")}>
            <option value="score">Best leads first</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
      </div>

      <div aria-live="polite" className="mt-4">
        {load.kind === "loading" && <p className="text-sm">Loading leads…</p>}
        {load.kind === "error" && (
          <p role="alert" className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm">
            {load.message}
          </p>
        )}
        {load.kind === "ready" && leads.length === 0 && (
          <p className="rounded-lg border border-black/10 p-6 text-center text-sm dark:border-white/15">
            {dueOnly ? "No follow-ups due today." : query ? "No leads match these filters." : "No leads yet. "}
            {!query && (
              <>
                Open the{" "}
                <Link href="/" className="underline">
                  map
                </Link>
                , click a business and choose <strong>Save as lead</strong>.
              </>
            )}
          </p>
        )}
      </div>

      {load.kind === "ready" && leads.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Saved leads</caption>
            <thead className="border-b border-black/15 dark:border-white/20">
              <tr>
                <th scope="col" className="py-2 pr-4">Score</th>
                <th scope="col" className="py-2 pr-4">Business</th>
                <th scope="col" className="py-2 pr-4">Category</th>
                <th scope="col" className="py-2 pr-4">Web presence</th>
                <th scope="col" className="py-2 pr-4">Status</th>
                <th scope="col" className="py-2 pr-4">Website check</th>
                <th scope="col" className="py-2 pr-4">Last contacted</th>
                <th scope="col" className="py-2 pr-4">Follow up</th>
                <th scope="col" className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((lead) => {
                const presenceStyle = lead.place ? PRESENCE_STYLES[lead.place.web_presence] : null;
                return (
                  <tr
                    key={lead.id}
                    className={`border-b border-black/10 dark:border-white/10 ${lead.id === selectedId ? "bg-blue-500/10" : ""}`}
                  >
                    <td className="py-2 pr-4 tabular-nums font-semibold">{leadScore(lead)}</td>
                    <td className="py-2 pr-4">
                      <bdi>{lead.label ?? lead.place?.name ?? "Unnamed"}</bdi>
                      {lead.place?.has_instagram && <span className="ml-1 text-xs text-pink-700">IG</span>}
                    </td>
                    <td className="py-2 pr-4">{humanizeCategory(lead.place?.basic_category ?? null)}</td>
                    <td className="py-2 pr-4">
                      {presenceStyle && (
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: presenceStyle.color }} />
                          {presenceStyle.label}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{LEAD_STATUS_LABELS[lead.lead_status]}</td>
                    <td className="py-2 pr-4">
                      {lead.website_status ? WEBSITE_STATUS_LABELS[lead.website_status]?.label : "Not checked"}
                      {lead.website_checked_at && (
                        <span className="block text-xs opacity-70">{formatDate(lead.website_checked_at)}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{formatDate(lead.last_contacted_at)}</td>
                    <td className="py-2 pr-4">
                      {lead.follow_up_on && wantsFollowUp(lead.lead_status) ? (
                        <span className={isDue(lead.follow_up_on, lead.lead_status, today) ? "font-semibold text-red-700" : ""}>
                          {lead.follow_up_on === today ? "Today" : lead.follow_up_on < today ? `Overdue (${lead.follow_up_on})` : lead.follow_up_on}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">
                      <button type="button" onClick={() => select(lead.id)} className="underline">
                        Open<span className="sr-only"> {lead.label ?? "lead"}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {leads.length >= 1000 && <p className="mt-2 text-xs opacity-70">Showing the 1,000 most recently updated leads.</p>}
        </div>
      )}

      {selected && (
        <LeadEditor
          key={selected.id}
          lead={selected}
          onClose={() => select(null)}
          onSaved={(lead) => setLeads((all) => all.map((l) => (l.id === lead.id ? lead : l)))}
          onDeleted={(id) => {
            setLeads((all) => all.filter((l) => l.id !== id));
            select(null);
          }}
        />
      )}
    </main>
  );
}
