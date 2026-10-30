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
  IconPhone,
  IconStar,
  InlineMessage,
  Spinner,
} from "@/components/ui";
import { humanizeCategory } from "@/lib/places/categories";
import { googleMapsCoordinatesUrl, googleMapsSearchUrl, safeHref, telHref } from "@/lib/places/links";
import { isInstagramUrl } from "@/lib/places/webPresence";
import type { Lead } from "@/lib/server/leadsStore";
import type { PlaceDetails } from "@/lib/server/placesStore";
import { GoogleRatingCard } from "./GoogleRatingCard";
import { PRESENCE_STYLES } from "./placeStyles";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "loaded"; place: PlaceDetails };

function LinkList({ title, urls }: { title: string; urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-medium text-muted">{title}</h3>
      <ul className="mt-1 space-y-1 text-sm">
        {urls.map((url) => {
          const href = safeHref(url);
          return (
            <li key={url} className="flex items-center gap-2 break-all">
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-info hover:underline">
                  {url}
                </a>
              ) : (
                url
              )}
              {isInstagramUrl(url) && <InstagramBadge />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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

  if (state.kind === "loading") return <Spinner label="Checking leads…" />;
  if (state.kind === "error") return <InlineMessage tone="danger">{state.message}</InlineMessage>;
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
    <Button variant="primary" className="w-full" onClick={save} disabled={state.kind === "saving"}>
      <IconStar />
      {state.kind === "saving" ? "Saving…" : "Save as lead"}
    </Button>
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

      {place.phones.length > 0 && (
        <div className="flex flex-wrap gap-2">
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

      <GoogleRatingCard name={place.name} area={place.area} lat={place.lat} lon={place.lon} />

      <LinkList title="Website" urls={place.websites} />
      <LinkList title="Social links" urls={place.socials} />

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
