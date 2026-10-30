// Named import areas. Add a city here (or pass --bbox to the import script)
// to switch locations without other code changes.

/** [west, south, east, north] in degrees (WGS84). */
export type BBox = [number, number, number, number];

export interface Area {
  name: string;
  bbox: BBox;
  /** Initial map view: [lon, lat] and zoom. */
  center: [number, number];
  zoom: number;
}

export const AREAS: Record<string, Area> = {
  jeddah: { name: "Jeddah", bbox: [39.05, 21.25, 39.35, 21.85], center: [39.15, 21.585], zoom: 14 },
};

export const DEFAULT_AREA = AREAS.jeddah;

// Keeps a single import small enough for the Supabase Free plan.
export const MAX_BBOX_SPAN_DEGREES = 1;

export function validateBBox(bbox: number[]): string | null {
  if (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) {
    return "bbox must be four numbers: west,south,east,north";
  }
  const [west, south, east, north] = bbox;
  if (west < -180 || east > 180 || south < -90 || north > 90) return "bbox is out of range";
  if (west >= east || south >= north) return "bbox must have west < east and south < north";
  if (east - west > MAX_BBOX_SPAN_DEGREES || north - south > MAX_BBOX_SPAN_DEGREES) {
    return `bbox may span at most ${MAX_BBOX_SPAN_DEGREES} degree in each direction`;
  }
  return null;
}
