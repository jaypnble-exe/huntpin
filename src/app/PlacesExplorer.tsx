"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_AREA, validateBBox, type BBox } from "@/lib/places/areas";
import { CATEGORY_GROUPS, isCategoryGroup } from "@/lib/places/categories";
import {
  CONFIDENCE_OPTIONS,
  DEFAULT_FILTERS,
  MAX_NAME_QUERY_LENGTH,
  toSearchParams,
  type PlaceFilters,
} from "@/lib/places/filters";
import { WEB_PRESENCE, type WebPresence } from "@/lib/places/webPresence";
import type { PlaceFeatureCollection } from "@/lib/server/placesStore";
import { LeadMap } from "./LeadMap";
import { PlaceDetailsPanel } from "./PlaceDetailsPanel";
import { INSTAGRAM_RING_COLOR, PRESENCE_STYLES } from "./placeStyles";

const EMPTY: PlaceFeatureCollection = { type: "FeatureCollection", features: [], truncated: false };
const FETCH_DEBOUNCE_MS = 300;

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "zoom_in" }
  | { kind: "error"; message: string };

export function PlacesExplorer() {
  const [filters, setFilters] = useState<PlaceFilters>(DEFAULT_FILTERS);
  const [nameInput, setNameInput] = useState("");
  const [bbox, setBBox] = useState<BBox | null>(null);
  const [data, setData] = useState<PlaceFeatureCollection>(EMPTY);
  const [load, setLoad] = useState<LoadState>({ kind: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Debounce typing in the name search.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, nameQuery: nameInput.trim() })), 400);
    return () => clearTimeout(timer);
  }, [nameInput]);

  useEffect(() => {
    if (!bbox) return;
    // The server refuses boxes over 1 degree; ask the user to zoom in instead.
    if (validateBBox(bbox)) {
      setData(EMPTY);
      setLoad({ kind: "zoom_in" });
      return;
    }
    if (filters.presence.length === 0) {
      setData(EMPTY);
      setLoad({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoad({ kind: "loading" });
      try {
        const response = await fetch(`/api/places?${toSearchParams(bbox, filters)}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message ?? "Places could not be loaded.");
        setData(body as PlaceFeatureCollection);
        setLoad({ kind: "idle" });
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoad({ kind: "error", message: error instanceof Error ? error.message : "Places could not be loaded." });
      }
    }, FETCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [bbox, filters]);

  const counts = useMemo(() => {
    const result: Partial<Record<WebPresence, number>> = {};
    for (const feature of data.features) {
      result[feature.properties.presence] = (result[feature.properties.presence] ?? 0) + 1;
    }
    return result;
  }, [data]);

  const togglePresence = (presence: WebPresence) =>
    setFilters((f) => ({
      ...f,
      presence: f.presence.includes(presence) ? f.presence.filter((p) => p !== presence) : [...f.presence, presence],
    }));

  const handleBounds = useCallback((next: BBox) => setBBox(next), []);

  return (
    <div className="relative h-[calc(100dvh-3rem)] w-full overflow-hidden">
      <LeadMap
        area={DEFAULT_AREA}
        data={data}
        selectedId={selectedId}
        onBoundsChange={handleBounds}
        onSelect={setSelectedId}
      />

      {/* Search and filters */}
      <div className="absolute top-3 left-3 z-10 w-[min(22rem,calc(100%-4.5rem))] space-y-2">
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="place-search">
            Search by business name
          </label>
          <input
            id="place-search"
            type="search"
            dir="auto"
            maxLength={MAX_NAME_QUERY_LENGTH}
            placeholder="Search business name"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-neutral-900 shadow"
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="map-filters"
            className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-medium text-neutral-900 shadow"
          >
            Filters
          </button>
        </div>

        {filtersOpen && (
          <div
            id="map-filters"
            className="space-y-4 rounded-lg border border-black/15 bg-white p-4 text-sm text-neutral-900 shadow"
          >
            <fieldset>
              <legend className="font-semibold">Web presence (from open data)</legend>
              <div className="mt-2 space-y-1.5">
                {WEB_PRESENCE.map((presence) => (
                  <label key={presence} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filters.presence.includes(presence)}
                      onChange={() => togglePresence(presence)}
                    />
                    <span
                      aria-hidden
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: PRESENCE_STYLES[presence].color }}
                    />
                    {PRESENCE_STYLES[presence].label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.instagramOnly}
                onChange={(event) => setFilters((f) => ({ ...f, instagramOnly: event.target.checked }))}
              />
              Only places with Instagram
            </label>

            <label className="block">
              <span className="font-semibold">Category</span>
              <select
                className="mt-1 w-full rounded-md border border-black/20 px-2 py-1.5"
                value={filters.category ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setFilters((f) => ({ ...f, category: isCategoryGroup(value) ? value : null }));
                }}
              >
                <option value="">All categories</option>
                {Object.entries(CATEGORY_GROUPS).map(([key, group]) => (
                  <option key={key} value={key}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-semibold">Minimum existence confidence</span>
              <select
                className="mt-1 w-full rounded-md border border-black/20 px-2 py-1.5"
                value={filters.minConfidence}
                onChange={(event) => setFilters((f) => ({ ...f, minConfidence: Number(event.target.value) }))}
              >
                {CONFIDENCE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value === 0 ? "Any" : `${Math.round(value * 100)}% or more`}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-neutral-600">
                How likely the place still exists, per Overture. Low values are often stale.
              </span>
            </label>

            <button
              type="button"
              onClick={() => {
                setFilters(DEFAULT_FILTERS);
                setNameInput("");
              }}
              className="text-sm underline"
            >
              Reset filters
            </button>
          </div>
        )}

        <p
          role="status"
          aria-live="polite"
          className="inline-block rounded-md bg-white/90 px-2 py-1 text-xs text-neutral-900 shadow"
        >
          {load.kind === "loading" && "Loading places…"}
          {load.kind === "zoom_in" && "Zoom in to load places."}
          {load.kind === "error" && <span className="text-red-700">{load.message}</span>}
          {load.kind === "idle" &&
            (filters.presence.length === 0
              ? "Select at least one web presence type."
              : data.truncated
                ? `Showing the ${data.features.length.toLocaleString()} most reliable matches. Zoom in or narrow filters to see all.`
                : `${data.features.length.toLocaleString()} places in view`)}
        </p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-8 left-3 z-10 rounded-lg bg-white/90 p-2.5 text-xs text-neutral-900 shadow">
        <ul className="space-y-1">
          {WEB_PRESENCE.filter((p) => filters.presence.includes(p)).map((presence) => (
            <li key={presence} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-full border border-white"
                style={{ background: PRESENCE_STYLES[presence].color }}
              />
              {PRESENCE_STYLES[presence].label}
              <span className="text-neutral-500">{(counts[presence] ?? 0).toLocaleString()}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-full border-2 bg-white"
              style={{ borderColor: INSTAGRAM_RING_COLOR }}
            />
            Pink ring: has Instagram
          </li>
        </ul>
      </div>

      {selectedId && <PlaceDetailsPanel id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
