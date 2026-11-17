"use client";

import { useEffect, useState } from "react";

export interface GmailStatus {
  /** GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_TOKEN_KEY are set on the server. */
  configured: boolean;
  connected: boolean;
  email: string | null;
  /** BCC for outreach emails (OUTREACH_BCC, else the Gmail address +huntpin). */
  bcc: string | null;
  lastReplyCheckAt?: string | null;
  problem: string | null;
}

const UNKNOWN: GmailStatus = { configured: false, connected: false, email: null, bcc: null, problem: null };

// Loaded once per page visit and shared by every draft on the page.
let cache: Promise<GmailStatus> | null = null;

export function loadGmailStatus(refresh = false): Promise<GmailStatus> {
  if (refresh) cache = null;
  cache ??= fetch("/api/gmail")
    .then(async (response) => {
      if (!response.ok) throw new Error("gmail_status_unavailable");
      return (await response.json()) as GmailStatus;
    })
    .catch(() => {
      cache = null;
      return UNKNOWN;
    });
  return cache;
}

export function useGmailStatus(): [GmailStatus, () => void] {
  const [status, setStatus] = useState<GmailStatus>(UNKNOWN);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    loadGmailStatus(version > 0).then((s) => active && setStatus(s));
    return () => {
      active = false;
    };
  }, [version]);
  return [status, () => setVersion((v) => v + 1)];
}
