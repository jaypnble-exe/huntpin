"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { Area, BBox } from "@/lib/places/areas";
import type { PlaceFeatureCollection } from "@/lib/server/placesStore";
import { INSTAGRAM_RING_COLOR, PRESENCE_STYLES, SAVED_LEAD_COLOR } from "./placeStyles";

// OpenFreeMap: free vector tiles, no key or account.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// Copied from node_modules by scripts/copy-maplibre-worker.mjs.
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
const PLACES_ATTRIBUTION =
  'Places: <a href="https://overturemaps.org" target="_blank" rel="noopener">Overture Maps Foundation</a> ' +
  "(Meta, Microsoft, AllThePlaces and others; Foursquare data © 2024 Foursquare Labs, Inc. All rights reserved.)";

const SOURCE_ID = "places";
const EMPTY: PlaceFeatureCollection = { type: "FeatureCollection", features: [], truncated: false };

export interface LeadMapProps {
  area: Area;
  data: PlaceFeatureCollection;
  selectedId: string | null;
  onBoundsChange: (bbox: BBox) => void;
  onSelect: (id: string | null) => void;
}

export function LeadMap({ area, data, selectedId, onBoundsChange, onSelect }: LeadMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  // Keep the latest callbacks and data without re-creating the map.
  const latest = useRef({ data, selectedId, onBoundsChange, onSelect });
  latest.current = { data, selectedId, onBoundsChange, onSelect };

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      maplibregl.setWorkerUrl(`${WORKER_URL}?v=${maplibregl.getVersion()}`);

      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: area.center,
        zoom: area.zoom,
        attributionControl: { compact: true, customAttribution: PLACES_ATTRIBUTION },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), "top-right");
      map.addControl(new maplibregl.ScaleControl(), "bottom-right");

      const reportBounds = () => {
        const b = map!.getBounds();
        latest.current.onBoundsChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      };

      map.on("load", () => {
        map!.addSource(SOURCE_ID, { type: "geojson", data: latest.current.data });
        // Halo under places already saved as leads.
        map!.addLayer({
          id: "places-saved",
          type: "circle",
          source: SOURCE_ID,
          filter: ["to-boolean", ["get", "leadStatus"]],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 14, 9, 17, 13],
            "circle-color": SAVED_LEAD_COLOR,
            "circle-opacity": 0.85,
          },
        });
        map!.addLayer({
          id: "places-circles",
          type: "circle",
          source: SOURCE_ID,
          paint: {
            "circle-color": [
              "match",
              ["get", "presence"],
              "no_website_listed",
              PRESENCE_STYLES.no_website_listed.color,
              "social_only",
              PRESENCE_STYLES.social_only.color,
              "website_listed",
              PRESENCE_STYLES.website_listed.color,
              "possibly_closed",
              PRESENCE_STYLES.possibly_closed.color,
              "#000000",
            ],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 14, 5.5, 17, 9],
            "circle-stroke-width": ["case", ["get", "instagram"], 2.5, 1],
            "circle-stroke-color": ["case", ["get", "instagram"], INSTAGRAM_RING_COLOR, "#ffffff"],
          },
        });
        map!.addLayer({
          id: "places-selected",
          type: "circle",
          source: SOURCE_ID,
          // Apply a selection made before the map finished loading.
          filter: ["==", ["get", "id"], latest.current.selectedId ?? ""],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 7, 17, 14],
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-width": 3,
            "circle-stroke-color": "#2563eb",
          },
        });
        map!.addLayer({
          id: "places-labels",
          type: "symbol",
          source: SOURCE_ID,
          minzoom: 16,
          layout: {
            "text-field": ["coalesce", ["get", "name"], ""],
            "text-font": ["Noto Sans Regular"],
            "text-size": 11,
            "text-offset": [0, 1.1],
            "text-anchor": "top",
            "text-optional": true,
          },
          paint: { "text-color": "#1f2937", "text-halo-color": "#ffffff", "text-halo-width": 1.2 },
        });

        map!.on("click", "places-circles", (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "string") latest.current.onSelect(id);
        });
        map!.on("mouseenter", "places-circles", () => (map!.getCanvas().style.cursor = "pointer"));
        map!.on("mouseleave", "places-circles", () => (map!.getCanvas().style.cursor = ""));

        loadedRef.current = true;
        reportBounds();
      });
      map.on("moveend", () => loadedRef.current && reportBounds());
    })();

    return () => {
      cancelled = true;
      loadedRef.current = false;
      mapRef.current = null;
      map?.remove();
    };
  }, [area]);

  useEffect(() => {
    const source = loadedRef.current ? mapRef.current?.getSource<GeoJSONSource>(SOURCE_ID) : undefined;
    source?.setData(data ?? EMPTY);
  }, [data]);

  useEffect(() => {
    if (!loadedRef.current) return;
    mapRef.current?.setFilter("places-selected", ["==", ["get", "id"], selectedId ?? ""]);
  }, [selectedId]);

  return <div ref={containerRef} className="h-full w-full" role="region" aria-label="Map of places" />;
}
