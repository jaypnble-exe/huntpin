import type { WebPresence } from "@/lib/places/webPresence";

// Pin colours and labels, shared by the map, legend and details panel.
export const PRESENCE_STYLES: Record<WebPresence, { color: string; label: string; description: string }> = {
  no_website_listed: {
    color: "#16a34a",
    label: "No website listed",
    description: "No website or social profile in the data",
  },
  social_only: {
    color: "#f59e0b",
    label: "Social media only",
    description: "Only social links (Facebook, Instagram, Linktree, WhatsApp…)",
  },
  website_listed: {
    color: "#94a3b8",
    label: "Website listed",
    description: "A website is listed",
  },
  possibly_closed: {
    color: "#525252",
    label: "Possibly closed",
    description: "The data marks it as not open",
  },
};

export const INSTAGRAM_RING_COLOR = "#db2777";
