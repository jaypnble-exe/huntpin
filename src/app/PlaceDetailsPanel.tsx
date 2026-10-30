"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEAD_STATUS_LABELS } from "@/lib/leads/leads";
import { humanizeCategory } from "@/lib/places/categories";
import { googleMapsCoordinatesUrl, safeHref, telHref } from "@/lib/places/links";
import { isInstagramUrl } from "@/lib/places/webPresence";
import type { Lead } from "@/lib/server/leadsStore";
import type { PlaceDetails } from "@/lib/server/placesStore";
import { PRESENCE_STYLES } from "./placeStyles";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "loaded"; place: PlaceDetails };

function LinkList({ title, urls }: { title: string; urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-1 space-y-1">
        {urls.map((url) => {
          const href = safeHref(url);
          return (
            <li key={url} className="break-all">
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-700 underline">
                  {url}
                </a>
              ) : (
                url
              )}
              {isInstagramUrl(url) && <span className="ml-1 text-pink-700">(Instagram)</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PlaceDetailsPanel({ id, onClose }: { id: string; onClose: () => void }) {
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      aria-label="Place details"
      className="absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-y-auto rounded-t-xl bg-white p-4 text-sm text-neutral-900 shadow-2xl sm:inset-x-auto sm:top-3 sm:right-14 sm:bottom-auto sm:max-h-[calc(100%-1.5rem)] sm:w-96 sm:rounded-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold" dir="auto">
          {state.kind === "loaded" ? (state.place.name ?? "Unnamed place") : "Place details"}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close details" className="rounded px-2 text-xl leading-none">
          ×
        </button>
      </div>

      {state.kind === "loading" && <p className="mt-2">Loading…</p>}
      {state.kind === "error" && (
        <p role="alert" className="mt-2 text-red-700">
          {state.message}
        </p>
      )}
      {state.kind === "loaded" && (
        <>
          <LeadSave placeId={state.place.id} />
          <Details place={state.place} />
        </>
      )}
    </aside>
  );
}

type LeadState =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "saving" }
  | { kind: "saved"; lead: Lead }
  | { kind: "error"; message: string };

function LeadSave({ placeId }: { placeId: string }) {
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
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Could not save the lead." });
    }
  }

  return (
    <div className="mt-3 rounded-lg bg-neutral-100 p-3">
      {state.kind === "loading" && <p className="text-neutral-600">Checking leads…</p>}
      {(state.kind === "none" || state.kind === "saving") && (
        <button
          type="button"
          onClick={save}
          disabled={state.kind === "saving"}
          className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white disabled:opacity-50"
        >
          {state.kind === "saving" ? "Saving…" : "Save as lead"}
        </button>
      )}
      {state.kind === "saved" && (
        <p>
          Saved as lead · <strong>{LEAD_STATUS_LABELS[state.lead.lead_status]}</strong>{" "}
          <Link href={`/leads?lead=${state.lead.id}`} className="text-blue-700 underline">
            Open in Leads
          </Link>
        </p>
      )}
      {state.kind === "error" && (
        <p role="alert" className="text-red-700">
          {state.message}
        </p>
      )}
    </div>
  );
}

function Details({ place }: { place: PlaceDetails }) {
  const style = PRESENCE_STYLES[place.web_presence];
  const phones = place.phones.map((phone) => ({ phone, href: telHref(phone) }));
  const fromFoursquare = place.source_datasets.some((d) => d.toLowerCase() === "foursquare");

  return (
    <div className="mt-2 space-y-4">
      <p className="text-neutral-600">{humanizeCategory(place.basic_category)}</p>

      <div>
        <span
          className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium text-white"
          style={{ background: style.color }}
        >
          {style.label}
        </span>
        {place.has_instagram && (
          <span className="ml-2 inline-block rounded-full bg-pink-100 px-2.5 py-1 text-xs font-medium text-pink-800">
            Instagram
          </span>
        )}
        <p className="mt-2 text-xs text-neutral-600">
          {style.description}. Based on open data, which can be incomplete or out of date. Check before contacting
          the business.
        </p>
      </div>

      <LinkList title="Website" urls={place.websites} />
      <LinkList title="Social links" urls={place.socials} />

      {phones.length > 0 && (
        <div>
          <h3 className="font-semibold">Phone</h3>
          <ul className="mt-1 space-y-1">
            {phones.map(({ phone, href }) => (
              <li key={phone} dir="ltr">
                {href ? (
                  <a href={href} className="text-blue-700 underline">
                    {phone}
                  </a>
                ) : (
                  phone
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-neutral-600">Existence confidence</dt>
        <dd>{place.confidence === null ? "Unknown" : `${Math.round(place.confidence * 100)}%`}</dd>
        {place.operating_status && (
          <>
            <dt className="text-neutral-600">Operating status</dt>
            <dd>{place.operating_status.replace(/_/g, " ")}</dd>
          </>
        )}
        <dt className="text-neutral-600">Sources</dt>
        <dd>{place.source_datasets.join(", ") || "Unknown"}</dd>
        <dt className="text-neutral-600">Licences</dt>
        <dd>{place.source_licenses.join(", ") || "Unknown"}</dd>
        <dt className="text-neutral-600">Data release</dt>
        <dd>Overture {place.source_release}</dd>
      </dl>
      {fromFoursquare && (
        <p className="text-xs text-neutral-600">Copyright 2024 Foursquare Labs, Inc. All rights reserved.</p>
      )}

      <a
        href={googleMapsCoordinatesUrl(place.lat, place.lon)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-md border border-neutral-300 px-3 py-1.5 font-medium"
      >
        Open location in Google Maps<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}
