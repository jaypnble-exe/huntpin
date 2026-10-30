"use client";

import { useEffect, useState } from "react";
import { InstagramBadge, LeadStatusBadge, PresenceBadge, ScorePill } from "@/components/leads/LeadBadges";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Drawer,
  ExternalButtonLink,
  IconExternal,
  IconGlobe,
  IconMail,
  Input,
  IconPhone,
  IconStar,
  InlineMessage,
  Spinner,
} from "@/components/ui";
import { humanizeCategory } from "@/lib/places/categories";
import { googleMapsCoordinatesUrl, googleMapsSearchUrl, telHref } from "@/lib/places/links";
import { SocialLinks } from "@/components/leads/SocialLinks";
import { mailtoHref } from "@/lib/places/emails";
import type { Lead } from "@/lib/server/leadsStore";
import type { PlaceDetails } from "@/lib/server/placesStore";
import { PRESENCE_STYLES } from "./placeStyles";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "loaded"; place: PlaceDetails };


export function PlaceDetailsPanel({
  id,
  onClose,
  onLeadSaved,
}: {
  id: string;
  onClose: () => void;
  onLeadSaved?: () => void;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    fetch(`/api/places/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message ?? "Place could not be loaded.");
        setState({ kind: "loaded", place: body as PlaceDetails });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: "error", message: error instanceof Error ? error.message : "Place could not be loaded." });
      });
    return () => controller.abort();
  }, [id]);

  const place = state.kind === "loaded" ? state.place : null;

  return (
    <Drawer
      label="Place details"
      position="absolute"
      title={place ? (place.name ?? "Unnamed place") : "Place details"}
      subtitle={
        place && (
          <div className="flex flex-wrap items-center gap-1.5">
            <ScorePill score={place.lead_score} />
            <PresenceBadge presence={place.web_presence} />
            {place.has_instagram && <InstagramBadge />}
            <span className="text-xs">{humanizeCategory(place.basic_category)}</span>
          </div>
        )
      }
      onClose={onClose}
    >
      {state.kind === "loading" && <Spinner />}
      {state.kind === "error" && <Alert tone="danger">{state.message}</Alert>}
      {place && (
        <div className="space-y-5">
          <LeadSave placeId={place.id} onSaved={onLeadSaved} />
          <Details place={place} />
        </div>
      )}
    </Drawer>
  );
}

type LeadState =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "saving" }
  | { kind: "saved"; lead: Lead }
  | { kind: "error"; message: string };

function LeadSave({ placeId, onSaved }: { placeId: string; onSaved?: () => void }) {
  const [state, setState] = useState<LeadState>({ kind: "loading" });
  const [hideOpen, setHideOpen] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [hiding, setHiding] = useState(false);
  const [hideError, setHideError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    fetch(`/api/leads?placeId=${encodeURIComponent(placeId)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message ?? "Leads are unavailable.");
        setState(body.lead ? { kind: "saved", lead: body.lead } : { kind: "none" });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: "error", message: error instanceof Error ? error.message : "Leads are unavailable." });
      });
    return () => controller.abort();
  }, [placeId]);

  async function save() {
    setState({ kind: "saving" });
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "Could not save the lead.");
      setState({ kind: "saved", lead: body.lead });
      onSaved?.();
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Could not save the lead." });
    }
  }

  async function hide() {
    setHiding(true);
    setHideError(null);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, notAFit: { websiteUrl: websiteUrl.trim() || null } }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? "Could not hide this business.");
      setState({ kind: "saved", lead: body.lead });
      onSaved?.();
    } catch (error) {
      setHideError(error instanceof Error ? error.message : "Could not hide this business.");
    } finally {
      setHiding(false);
    }
  }

  if (state.kind === "loading") return <Spinner label="Checking leads…" />;
  if (state.kind === "error") return <InlineMessage tone="danger">{state.message}</InlineMessage>;
  if (state.kind === "saved" && state.lead.lead_status === "not_a_fit") {
    return (
      <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
        <p className="flex items-center gap-2">
          <LeadStatusBadge status="not_a_fit" /> Has a website, so it is hidden from the map.
        </p>
        <p className="mt-1 text-xs text-muted">
          Changed your mind? Open the lead and set another status.{" "}
          <a href={`/leads?lead=${state.lead.id}`} className="text-info hover:underline">
            Open lead
          </a>
        </p>
      </div>
    );
  }
  if (state.kind === "saved") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info/25 bg-info-soft p-3">
        <span className="flex items-center gap-2 text-sm">
          Saved as lead <LeadStatusBadge status={state.lead.lead_status} />
        </span>
        <ButtonLink href={`/leads?lead=${state.lead.id}`} size="sm" variant="primary">
          Open lead
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={save} disabled={state.kind === "saving" || hiding}>
          <IconStar />
          {state.kind === "saving" ? "Saving…" : "Save as lead"}
        </Button>
        <Button onClick={() => setHideOpen((open) => !open)} aria-expanded={hideOpen} disabled={state.kind === "saving"}>
          <IconGlobe />
          Has a website
        </Button>
      </div>
      {hideOpen && (
        <div className="space-y-2 rounded-lg border border-border bg-surface-muted p-3">
          <p className="text-xs text-muted">
            Found their website on Google Maps? Hide this business so it stops showing as a lead. Pasting the URL is
            optional.
          </p>
          <label className="sr-only" htmlFor="not-a-fit-url">
            Their website (optional)
          </label>
          <Input
            id="not-a-fit-url"
            dir="ltr"
            inputMode="url"
            placeholder="https://their-website.com (optional)"
            maxLength={2048}
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={hide} disabled={hiding}>
              {hiding ? "Hiding…" : "Hide this business"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setHideOpen(false)}>
              Cancel
            </Button>
            {hideError && <InlineMessage tone="danger">{hideError}</InlineMessage>}
          </div>
        </div>
      )}
    </div>
  );
}

function Details({ place }: { place: PlaceDetails }) {
  const style = PRESENCE_STYLES[place.web_presence];
  const fromFoursquare = place.source_datasets.some((d) => d.toLowerCase() === "foursquare");
  const maxPoints = Math.max(...place.score_parts.map((p) => p.points), 1);

  return (
    <>
      <p className="text-xs text-muted">
        {style.description}. Based on open data, which can be incomplete or out of date. Check before contacting the business.
      </p>

      {(place.phones.length > 0 || place.emails.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {place.emails.map((email) => {
            const href = mailtoHref(email);
            return href ? (
              <a key={email} href={href} dir="ltr" title={email} className="inline-flex h-8 max-w-60 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-xs font-medium hover:bg-surface-muted">
                <IconMail />
                <span className="truncate">{email}</span>
              </a>
            ) : null;
          })}
          {place.phones.map((phone) => {
            const href = telHref(phone);
            return href ? (
              <a key={phone} href={href} dir="ltr" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-xs font-medium hover:bg-surface-muted">
                <IconPhone />
                {phone}
              </a>
            ) : (
              <span key={phone} dir="ltr" className="text-sm">
                {phone}
              </span>
            );
          })}
        </div>
      )}

      <SocialLinks urls={[...place.websites, ...place.socials]} />

      <details className="group rounded-lg border border-border p-3">
        <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
          <span>Why this score</span>
          {place.chain_size >= 3 && <Badge>Chain · {place.chain_size} locations</Badge>}
        </summary>
        <ul className="mt-3 space-y-2 text-xs">
          {place.score_parts.map((part) => (
            <li key={part.label}>
              <div className="flex justify-between gap-3">
                <span>{part.label}</span>
                <span className="text-muted tabular-nums">+{part.points}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${(part.points / maxPoints) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </details>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-muted">Still exists</dt>
        <dd>{place.confidence === null ? "Not scored" : `${Math.round(place.confidence * 100)}%`}</dd>
        {place.operating_status && (
          <>
            <dt className="text-muted">Operating status</dt>
            <dd>{place.operating_status.replace(/_/g, " ")}</dd>
          </>
        )}
        <dt className="text-muted">Sources</dt>
        <dd>{place.source_datasets.join(", ") || "Unknown"}</dd>
        <dt className="text-muted">Licences</dt>
        <dd>{place.source_licenses.join(", ") || "Unknown"}</dd>
        <dt className="text-muted">Data</dt>
        <dd>
          {place.source === "foursquare"
            ? `Foursquare OS Places (imported ${place.source_release.replace("fsq-", "")})`
            : `Overture ${place.source_release}`}
        </dd>
      </dl>
      {fromFoursquare && <p className="text-xs text-muted">Copyright 2024 Foursquare Labs, Inc. All rights reserved.</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        <ExternalButtonLink href={googleMapsSearchUrl(place.name, place.area, place.lat, place.lon)} variant="primary">
          <IconExternal />
          Find on Google Maps
        </ExternalButtonLink>
        <ExternalButtonLink href={googleMapsCoordinatesUrl(place.lat, place.lon)}>
          <IconExternal />
          Open pin location
        </ExternalButtonLink>
      </div>
      <p className="text-xs text-muted">“Find on Google Maps” searches by name, which usually opens their listing with rating, reviews and photos.</p>
    </>
  );
}
