"use client";

import { useState } from "react";
import { isSocialUrl } from "@/lib/places/webPresence";
import type { Lead } from "@/lib/server/leadsStore";

export const WEBSITE_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  reachable: { label: "Reachable", className: "bg-green-100 text-green-800" },
  unreachable: { label: "Unreachable", className: "bg-red-100 text-red-800" },
  needs_manual_review: { label: "Needs manual review", className: "bg-amber-100 text-amber-900" },
  not_listed: { label: "Website URL not listed", className: "bg-neutral-200 text-neutral-800" },
};

const ERROR_DESCRIPTIONS: Record<string, string> = {
  dns_not_found: "The domain does not resolve (it may have expired).",
  dns_error: "The domain could not be looked up.",
  timeout: "The site did not respond in time.",
  connection_refused: "The server refused the connection.",
  connection_reset: "The connection was dropped.",
  network_unreachable: "The server could not be reached.",
  network_error: "A network error occurred.",
  tls_error: "The site's HTTPS certificate or setup is broken.",
  not_found: "The page returned 'not found'.",
  server_error: "The server returned an error.",
  access_restricted: "The site blocked the check (it may still work in a browser).",
  rate_limited: "The site asked us to slow down.",
  too_many_redirects: "Too many redirects.",
  redirect_without_location: "A redirect had no destination.",
  invalid_redirect: "A redirect pointed to an invalid address.",
  unsupported_redirect: "A redirect pointed somewhere that is not checked (non-web scheme or port).",
  blocked_address: "The site points to a private or reserved network address, so it was not contacted.",
};

function defaultUrl(lead: Lead): string {
  if (lead.website_url) return lead.website_url;
  return lead.place?.websites.find((url) => !isSocialUrl(url)) ?? "";
}

export function WebsiteCheck({ lead, onChecked }: { lead: Lead; onChecked: (lead: Lead) => void }) {
  const [url, setUrl] = useState(defaultUrl(lead));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${lead.id}/website-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "The check failed.");
      onChecked(body.lead as Lead);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The check failed.");
    } finally {
      setBusy(false);
    }
  }

  const status = lead.website_status ? WEBSITE_STATUS_LABELS[lead.website_status] : null;
  const noWebsiteListed = !defaultUrl(lead);

  return (
    <section aria-labelledby="website-check-heading">
      <h3 id="website-check-heading" className="font-semibold">
        Website check
      </h3>
      <p className="mt-1 text-xs text-neutral-600">
        One lightweight request; only the response status is read and stored. “Reachable” does not mean the site is
        good, so look at it yourself before mentioning it to the business.
      </p>
      {noWebsiteListed && !lead.website_checked_at && (
        <p className="mt-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${WEBSITE_STATUS_LABELS.not_listed.className}`}>
            {WEBSITE_STATUS_LABELS.not_listed.label}
          </span>
          <span className="ml-2 text-xs text-neutral-600">If you find their site, enter it below.</span>
        </p>
      )}

      <form onSubmit={check} className="mt-2 flex gap-2">
        <label className="sr-only" htmlFor="website-url">
          Website URL
        </label>
        <input
          id="website-url"
          type="text"
          inputMode="url"
          dir="ltr"
          placeholder="https://example.com"
          maxLength={2048}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1.5"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="rounded-md border border-neutral-300 px-3 py-1.5 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Check website"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-red-700">
          {error}
        </p>
      )}

      {status && lead.website_checked_at && (
        <div className="mt-3 space-y-1 text-xs" aria-live="polite">
          <p>
            <span className={`rounded-full px-2.5 py-1 font-medium ${status.className}`}>{status.label}</span>
            {lead.website_http_status !== null && <span className="ml-2">HTTP {lead.website_http_status}</span>}
            <span className="ml-2 text-neutral-600">checked {new Date(lead.website_checked_at).toLocaleString()}</span>
          </p>
          {lead.website_error_category && (
            <p className="text-neutral-700">
              {ERROR_DESCRIPTIONS[lead.website_error_category] ?? lead.website_error_category}
            </p>
          )}
          {lead.website_final_url && lead.website_final_url !== lead.website_url && (
            <p className="break-all text-neutral-600" dir="ltr">
              Ended at: {lead.website_final_url}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
