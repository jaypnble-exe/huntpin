"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScorePill } from "@/components/leads/LeadBadges";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  IconFilter,
  IconSearch,
  IconStar,
  Input,
  SegmentedControl,
  Select,
  ToggleChip,
  cn,
} from "@/components/ui";
import { DEFAULT_AREA, validateBBox, type BBox } from "@/lib/places/areas";
import { CATEGORY_GROUPS, isCategoryGroup } from "@/lib/places/categories";
import {
  CONFIDENCE_OPTIONS,
  DEFAULT_FILTERS,
  MAX_NAME_QUERY_LENGTH,
  toSearchParams,
  type PlaceFilters,
  type SavedFilter,
} from "@/lib/places/filters";
import { WEB_PRESENCE, type WebPresence } from "@/lib/places/webPresence";
import type { PlaceFeatureCollection } from "@/lib/server/placesStore";
import { LeadMap } from "./LeadMap";
import { PlaceDetailsPanel } from "./PlaceDetailsPanel";
import { INSTAGRAM_RING_COLOR, PRESENCE_STYLES, SAVED_LEAD_COLOR } from "./placeStyles";

const EMPTY: PlaceFeatureCollection = { type: "FeatureCollection", features: [], truncated: false };
const SAVED_OPTIONS: { value: SavedFilter; label: string }[] = [
  { value: "all", label: "Show" },
  { value: "hide", label: "Hide" },
  { value: "only", label: "Only saved" },
];
const FETCH_DEBOUNCE_MS = 300;

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "zoom_in" }
  | { kind: "error"; message: string };

/** Reads `?place=<id>&lat=<lat>&lon=<lon>` (from "Show on map") to focus one place. */
function useFocusedPlace() {
  const params = useSearchParams();
  return useMemo(() => {
    const place = params.get("place");
    const lat = Number(params.get("lat"));
    const lon = Number(params.get("lon"));
    if (!place || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return { area: DEFAULT_AREA, placeId: null };
    }
    return { area: { ...DEFAULT_AREA, center: [lon, lat] as [number, number], zoom: 17 }, placeId: place };
  }, [params]);
}

/** How many filters differ from the defaults (shown on the Filters button). */
function activeFilterCount(filters: PlaceFilters): number {
  const d = DEFAULT_FILTERS;
  return [
    [...filters.presence].sort().join() !== [...d.presence].sort().join(),
    filters.minConfidence !== d.minConfidence,
    filters.category !== d.category,
    filters.instagramOnly !== d.instagramOnly,
    filters.saved !== d.saved,
    filters.hideChains !== d.hideChains,
  ].filter(Boolean).length;
}

export function PlacesExplorer() {
  const focus = useFocusedPlace();
  const [filters, setFilters] = useState<PlaceFilters>(DEFAULT_FILTERS);
  const [nameInput, setNameInput] = useState("");
  const [bbox, setBBox] = useState<BBox | null>(null);
  const [data, setData] = useState<PlaceFeatureCollection>(EMPTY);
  const [load, setLoad] = useState<LoadState>({ kind: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(focus.placeId);
  const [panel, setPanel] = useState<"none" | "filters" | "best">("none");
  // Bumped after saving a lead so its pin gets the saved halo.
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [bbox, filters, reloadKey]);

  const bestInView = useMemo(
    () => [...data.features].sort((a, b) => b.properties.score - a.properties.score).slice(0, 15),
    [data],
  );

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
  const togglePanel = (next: "filters" | "best") => setPanel((current) => (current === next ? "none" : next));
  const filterCount = activeFilterCount(filters);

  return (
    <div className="relative h-[calc(100dvh-3rem)] w-full overflow-hidden">
      <LeadMap
        area={focus.area}
        data={data}
        selectedId={selectedId}
        onBoundsChange={handleBounds}
        onSelect={setSelectedId}
      />

      {/* Toolbar, panels and status */}
      <div className="absolute top-3 left-3 z-10 w-[min(24rem,calc(100%-4.5rem))] space-y-2">
        <Card className="flex items-center gap-1.5 p-1.5">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted" />
            <label className="sr-only" htmlFor="place-search">
              Search by business name
            </label>
            <Input
              id="place-search"
              type="search"
              dir="auto"
              maxLength={MAX_NAME_QUERY_LENGTH}
              placeholder="Search businesses"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              className="border-transparent pl-8 shadow-none"
            />
          </div>
          <Button
            variant={panel === "filters" ? "primary" : "ghost"}
            onClick={() => togglePanel("filters")}
            aria-expanded={panel === "filters"}
            aria-controls="map-filters"
          >
            <IconFilter />
            Filters
            {filterCount > 0 && (
              <span className="rounded-full bg-info-soft px-1.5 text-xs text-info">{filterCount}</span>
            )}
          </Button>
          <Button
            variant={panel === "best" ? "primary" : "ghost"}
            onClick={() => togglePanel("best")}
            aria-expanded={panel === "best"}
            aria-controls="best-leads"
          >
            <IconStar />
            Best
          </Button>
        </Card>

        {panel === "best" && (
          <Card id="best-leads" className="max-h-[55dvh] overflow-y-auto p-3">
            <h2 className="px-1 text-sm font-semibold">Best leads in view</h2>
            {bestInView.length === 0 ? (
              <p className="mt-1 px-1 text-xs text-muted">No places in view.</p>
            ) : (
              <ol className="mt-2 space-y-0.5">
                {bestInView.map((feature) => (
                  <li key={feature.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(feature.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-muted",
                        feature.id === selectedId && "bg-info-soft",
                      )}
                    >
                      <ScorePill score={feature.properties.score} />
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: PRESENCE_STYLES[feature.properties.presence].color }}
                      />
                      <bdi className="min-w-0 flex-1 truncate">{feature.properties.name ?? "Unnamed"}</bdi>
                      {feature.properties.leadStatus && <Badge tone="info">Saved</Badge>}
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-2 px-1 text-xs text-muted">
              Score from web presence, phone, Instagram, category and how current the listing is.
            </p>
          </Card>
        )}

        {panel === "filters" && (
          <Card id="map-filters" className="max-h-[65dvh] space-y-4 overflow-y-auto p-4">
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-muted">Web presence (from open data)</legend>
              <div className="flex flex-wrap gap-1.5">
                {WEB_PRESENCE.map((presence) => (
                  <ToggleChip
                    key={presence}
                    pressed={filters.presence.includes(presence)}
                    onToggle={() => togglePresence(presence)}
                    dot={PRESENCE_STYLES[presence].color}
                  >
                    {PRESENCE_STYLES[presence].label}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Checkbox
                label="Only places with Instagram"
                checked={filters.instagramOnly}
                onChange={(event) => setFilters((f) => ({ ...f, instagramOnly: event.target.checked }))}
              />
              <Checkbox
                label="Show chains (names at 3+ locations)"
                checked={!filters.hideChains}
                onChange={(event) => setFilters((f) => ({ ...f, hideChains: !event.target.checked }))}
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted">Saved leads</p>
              <SegmentedControl
                label="Saved leads"
                size="sm"
                options={SAVED_OPTIONS}
                value={filters.saved}
                onChange={(saved) => setFilters((f) => ({ ...f, saved }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select
                  value={filters.category ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFilters((f) => ({ ...f, category: isCategoryGroup(value) ? value : null }));
                  }}
                >
                  <option value="">All</option>
                  {Object.entries(CATEGORY_GROUPS).map(([key, group]) => (
                    <option key={key} value={key}>
                      {group.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Still exists (Overture)">
                <Select
                  value={filters.minConfidence}
                  onChange={(event) => setFilters((f) => ({ ...f, minConfidence: Number(event.target.value) }))}
                >
                  {CONFIDENCE_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value === 0 ? "Any" : `${Math.round(value * 100)}%+`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex justify-between border-t border-border pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setNameInput("");
                }}
              >
                Reset filters
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPanel("none")}>
                Done
              </Button>
            </div>
          </Card>
        )}

        <p
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-1 text-xs shadow-sm"
        >
          {load.kind === "loading" && (
            <>
              <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-border-strong border-t-primary" />
              Loading places…
            </>
          )}
          {load.kind === "zoom_in" && "Zoom in to load places"}
          {load.kind === "error" && <span className="text-danger">{load.message}</span>}
          {load.kind === "idle" &&
            (filters.presence.length === 0
              ? "Select at least one web presence type"
              : data.truncated
                ? `Best ${data.features.length.toLocaleString()} shown · zoom in for all`
                : `${data.features.length.toLocaleString()} places in view`)}
        </p>
      </div>

      {/* Legend */}
      <Card className="absolute bottom-8 left-3 z-10 p-3 text-xs">
        <ul className="space-y-1.5">
          {WEB_PRESENCE.filter((p) => filters.presence.includes(p)).map((presence) => (
            <li key={presence} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-full ring-1 ring-white"
                style={{ background: PRESENCE_STYLES[presence].color }}
              />
              <span className="flex-1">{PRESENCE_STYLES[presence].label}</span>
              <span className="pl-3 text-muted tabular-nums">{(counts[presence] ?? 0).toLocaleString()}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-3 w-3 rounded-full border-2 bg-surface" style={{ borderColor: INSTAGRAM_RING_COLOR }} />
            Has Instagram
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: SAVED_LEAD_COLOR }} />
            Saved lead
          </li>
        </ul>
      </Card>

      {selectedId && (
        <PlaceDetailsPanel
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onLeadSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
