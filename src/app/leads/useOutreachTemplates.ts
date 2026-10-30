"use client";

import { useEffect, useState } from "react";
import { DEFAULT_TEMPLATES, type OutreachTemplates } from "@/lib/leads/outreach";

// Loaded once per page visit and shared by every draft on the page.
let cache: Promise<OutreachTemplates> | null = null;

function load(): Promise<OutreachTemplates> {
  cache ??= fetch("/api/templates")
    .then(async (response) => {
      if (!response.ok) throw new Error("templates_unavailable");
      return ((await response.json()) as { templates: OutreachTemplates }).templates;
    })
    .catch(() => {
      cache = null; // Try again next time; use the defaults meanwhile.
      return DEFAULT_TEMPLATES;
    });
  return cache;
}

/** Call after saving or resetting templates so drafts pick up the change. */
export function setCachedTemplates(templates: OutreachTemplates) {
  cache = Promise.resolve(templates);
}

/** The operator's templates; the defaults until they load (or if they can't). */
export function useOutreachTemplates(): OutreachTemplates {
  const [templates, setTemplates] = useState<OutreachTemplates>(DEFAULT_TEMPLATES);
  useEffect(() => {
    let active = true;
    load().then((t) => active && setTemplates(t));
    return () => {
      active = false;
    };
  }, []);
  return templates;
}
