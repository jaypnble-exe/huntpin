"use client";

import { useState } from "react";
import { Button, IconStar } from "@/components/ui";
import { googleMapsEmbedUrl } from "@/lib/places/links";

// Browser key restricted to the Maps Embed API (and to this site's URLs).
// Embeds are listed by Google as free with no usage cap; the Places API is
// not used and nothing from Google is stored by this app.
const EMBED_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY ?? "";

/**
 * Loads Google's own place card (rating, reviews, "View larger map") on
 * request, matched by business name and city near the pin.
 */
export function GoogleRatingCard({
  name,
  area,
  lat,
  lon,
}: {
  name: string | null;
  area: string | null;
  lat: number;
  lon: number;
}) {
  const [open, setOpen] = useState(false);
  const src = googleMapsEmbedUrl(EMBED_KEY, { name, area, lat, lon });

  if (!name) return null;
  if (!EMBED_KEY) {
    return (
      <p className="rounded-lg border border-dashed border-border-strong p-3 text-xs text-muted">
        To see Google ratings here, add a free Maps Embed key as <code>NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY</code> (see{" "}
        <code>docs/SETUP.md</code>). Until then, use “Find on Google Maps”.
      </p>
    );
  }
  if (!open) {
    return (
      <Button className="w-full" onClick={() => setOpen(true)}>
        <IconStar />
        Show Google rating & reviews
      </Button>
    );
  }
  return (
    <div className="space-y-1.5">
      <iframe
        title={`Google Maps listing for ${name}`}
        src={src ?? undefined}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        className="h-72 w-full rounded-lg border border-border"
      />
      <p className="text-xs text-muted">
        Shown by Google, matched by name near this pin. Check it is the same business before using it.
      </p>
    </div>
  );
}
