"use client";

import { useState } from "react";
import { WebsiteStatusBadge } from "@/components/leads/LeadBadges";
import { Badge, Button, IconGlobe, InlineMessage, Input, Section, cn } from "@/components/ui";
import { isSocialUrl } from "@/lib/places/webPresence";
import type { Lead } from "@/lib/server/leadsStore";
import { deriveOpportunities, type WebsiteSignals } from "@/lib/websiteSignals";

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

export function leadOpportunities(lead: Lead) {
  return deriveOpportunities({
    websiteStatus: lead.website_status,
    errorCategory: lead.website_error_category,
    signals: lead.website_signals,
    category: lead.place?.basic_category ?? null,
  });
}

export function defaultUrl(lead: Lead): string {
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

  const noWebsiteListed = !defaultUrl(lead);

  return (
    <Section
      title="Website"
      description="Reads at most the first 256 KB of the homepage. Only yes/no signals are stored, never page content."
    >
      {noWebsiteListed && !lead.website_checked_at && (
        <p className="mb-2 flex items-center gap-2 text-xs text-muted">
          <WebsiteStatusBadge status="not_listed" /> If you find their site, enter it below.
        </p>
      )}

      <form onSubmit={check} className="flex gap-2">
        <label className="sr-only" htmlFor="website-url">
          Website URL
        </label>
        <Input
          id="website-url"
          type="text"
          inputMode="url"
          dir="ltr"
          placeholder="https://example.com"
          maxLength={2048}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={busy || !url.trim()}>
          <IconGlobe />
          {busy ? "Checking…" : "Check"}
        </Button>
      </form>
      {error && (
        <p className="mt-2">
          <InlineMessage tone="danger">{error}</InlineMessage>
        </p>
      )}

      {lead.website_status && lead.website_checked_at && (
        <div className="mt-3 space-y-2 rounded-lg bg-surface-muted p-3 text-xs" aria-live="polite">
          <p className="flex flex-wrap items-center gap-2">
            <WebsiteStatusBadge status={lead.website_status} />
            {lead.website_http_status !== null && <span>HTTP {lead.website_http_status}</span>}
            <span className="text-muted">checked {new Date(lead.website_checked_at).toLocaleString()}</span>
          </p>
          {lead.website_error_category && (
            <p>{ERROR_DESCRIPTIONS[lead.website_error_category] ?? lead.website_error_category}</p>
          )}
          {lead.website_final_url && lead.website_final_url !== lead.website_url && (
            <p className="break-all text-muted" dir="ltr">
              Ended at: {lead.website_final_url}
            </p>
          )}
          {lead.website_signals && <SignalChips signals={lead.website_signals} />}
        </div>
      )}

      {lead.website_checked_at && <Opportunities lead={lead} onChecked={onChecked} />}
    </Section>
  );
}

function SignalChips({ signals }: { signals: WebsiteSignals }) {
  const chips: { text: string; good: boolean | null }[] = [
    { text: signals.https ? "HTTPS" : "No HTTPS", good: signals.https },
    ...(signals.responseMs !== null
      ? [{ text: `First response ${(signals.responseMs / 1000).toFixed(1)} s`, good: signals.responseMs <= 3000 }]
      : []),
    signals.htmlRead
      ? { text: signals.mobileViewport ? "Mobile viewport" : "No mobile viewport", good: Boolean(signals.mobileViewport) }
      : { text: "Page not readable", good: null },
    ...(signals.hasArabic === null ? [] : [{ text: signals.hasArabic ? "Arabic content" : "No Arabic content", good: signals.hasArabic }]),
    ...(signals.hasForm === null ? [] : [{ text: signals.hasForm ? "Has a form" : "No form", good: signals.hasForm }]),
    ...(signals.sitePlatform ? [{ text: `Built with ${signals.sitePlatform}`, good: null }] : []),
    ...signals.deliveryApps.map((app) => ({ text: app, good: null })),
    ...signals.bookingTools.map((tool) => ({ text: `Booking: ${tool}`, good: true })),
  ];
  return (
    <ul aria-label="Homepage signals" className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <li key={chip.text}>
          <Badge tone={chip.good === null ? "neutral" : chip.good ? "success" : "warning"}>{chip.text}</Badge>
        </li>
      ))}
    </ul>
  );
}

function Opportunities({ lead, onChecked }: { lead: Lead; onChecked: (lead: Lead) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opportunities = leadOpportunities(lead);

  async function toggle(key: string, confirmed: boolean) {
    const next = confirmed
      ? [...new Set([...lead.confirmed_opportunities, key])]
      : lead.confirmed_opportunities.filter((k) => k !== key);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedOpportunities: next }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "Could not save.");
      onChecked(body.lead as Lead);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (opportunities.length === 0) {
    return <p className="mt-3 text-xs text-muted">No obvious opportunities found on the homepage.</p>;
  }
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">Possible opportunities · verify first</h4>
      <ul className="mt-2 space-y-2">
        {opportunities.map((o) => {
          const confirmed = lead.confirmed_opportunities.includes(o.key);
          return (
            <li
              key={o.key}
              className={cn("rounded-lg border p-3", confirmed ? "border-success/40 bg-success-soft" : "border-border")}
            >
              <p className="text-sm font-medium">{o.title}</p>
              <p className="mt-0.5 text-xs text-muted">{o.detail}</p>
              {o.sentence && (
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    disabled={saving}
                    checked={confirmed}
                    onChange={(e) => toggle(o.key, e.target.checked)}
                  />
                  I checked this — add it to the draft
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="mt-1">
          <InlineMessage tone="danger">{error}</InlineMessage>
        </p>
      )}
    </div>
  );
}
