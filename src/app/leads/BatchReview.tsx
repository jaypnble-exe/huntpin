"use client";

import { useRef, useState } from "react";
import { BATCH_REVIEW_INTERVAL_MS, pickBatchCandidates } from "@/lib/leads/batchReview";
import type { Lead } from "@/lib/server/leadsStore";
import { defaultUrl } from "./WebsiteCheck";

type State =
  | { kind: "idle" }
  | { kind: "running"; done: number; total: number; current: string }
  | { kind: "finished"; counts: Record<string, number>; stopped: boolean };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reviews several saved leads' websites one at a time, on request. */
export function BatchReview({ leads, onUpdated }: { leads: Lead[]; onUpdated: (lead: Lead) => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const stopRef = useRef(false);
  const candidates = pickBatchCandidates(
    leads.map((lead) => ({ ...lead, url: defaultUrl(lead) })),
    new Date(),
  );

  async function checkOne(id: string, url: string): Promise<Lead | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`/api/leads/${id}/website-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (response.status === 429 && attempt === 0) {
        await sleep(60_000); // Server limit reached: wait a minute, then retry once.
        continue;
      }
      if (!response.ok) return null;
      return (await response.json()).lead as Lead;
    }
    return null;
  }

  async function run() {
    const minutes = Math.ceil((candidates.length * BATCH_REVIEW_INTERVAL_MS) / 60_000);
    if (!window.confirm(`Check ${candidates.length} websites, one every ${BATCH_REVIEW_INTERVAL_MS / 1000} seconds (about ${minutes} min)? Keep this tab open.`)) return;
    stopRef.current = false;
    const counts: Record<string, number> = {};
    for (let i = 0; i < candidates.length; i++) {
      if (stopRef.current) break;
      const { id, url } = candidates[i];
      const name = leads.find((l) => l.id === id)?.label ?? url;
      setState({ kind: "running", done: i, total: candidates.length, current: name });
      try {
        const updated = await checkOne(id, url);
        const key = updated?.website_status ?? "failed";
        counts[key] = (counts[key] ?? 0) + 1;
        if (updated) onUpdated(updated);
      } catch {
        counts.failed = (counts.failed ?? 0) + 1;
      }
      if (i < candidates.length - 1 && !stopRef.current) await sleep(BATCH_REVIEW_INTERVAL_MS);
    }
    setState({ kind: "finished", counts, stopped: stopRef.current });
  }

  const labels: Record<string, string> = {
    reachable: "reachable",
    unreachable: "unreachable",
    needs_manual_review: "need manual review",
    failed: "could not be checked",
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {state.kind === "running" ? (
        <>
          <span role="status" aria-live="polite">
            Checking {state.done + 1} of {state.total}: <bdi>{state.current}</bdi>
          </span>
          <button type="button" onClick={() => (stopRef.current = true)} className="rounded-md border border-current px-3 py-1.5">
            Stop
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={run}
          disabled={candidates.length === 0}
          title={candidates.length === 0 ? "No saved leads with a website that needs checking" : undefined}
          className="rounded-md border border-current px-3 py-1.5 font-medium disabled:opacity-40"
        >
          Review websites ({candidates.length})
        </button>
      )}
      {state.kind === "finished" && (
        <span role="status" className="text-xs opacity-80">
          {state.stopped ? "Stopped. " : "Done. "}
          {Object.entries(state.counts)
            .map(([key, n]) => `${n} ${labels[key] ?? key}`)
            .join(", ") || "Nothing checked."}{" "}
          Open a lead to see its opportunities.
        </span>
      )}
    </div>
  );
}
