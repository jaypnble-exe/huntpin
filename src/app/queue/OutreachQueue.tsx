"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { InstagramBadge, LeadStatusBadge, PresenceBadge, ScorePill } from "@/components/leads/LeadBadges";
import { SocialLinks } from "@/components/leads/SocialLinks";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ExternalButtonLink,
  Field,
  IconCheck,
  IconExternal,
  IconMail,
  IconMapPin,
  IconPhone,
  InlineMessage,
  PageHeader,
  SegmentedControl,
  Select,
  Spinner,
  cn,
} from "@/components/ui";
import { MAX_FOLLOW_UPS } from "@/lib/leads/followUps";
import {
  DEFAULT_QUEUE_QUERY,
  MIN_SCORE_OPTIONS,
  toQueueParams,
  type QueueChannel,
  type QueueQuery,
} from "@/lib/leads/queue";
import { CATEGORY_GROUPS, categoryGroupOf, humanizeCategory, isCategoryGroup } from "@/lib/places/categories";
import { mailtoHref } from "@/lib/places/emails";
import { googleMapsSearchUrl, telHref } from "@/lib/places/links";
import type { Lead } from "@/lib/server/leadsStore";
import type { Queue, QueueItem } from "@/lib/server/queueStore";
import { pitchTypeOf } from "@/lib/leads/pitchTypes";
import { OutreachDraft } from "../leads/OutreachDraft";
import { leadOpportunities } from "../leads/WebsiteCheck";

type Mode = "fresh" | "followUps";
type LoadState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

// Skipped businesses stay out of the queue for two weeks, in this browser only.
const SKIP_KEY = "huntpin.queue.skipped";
const SKIP_DAYS = 14;

function readSkipped(): Record<string, number> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SKIP_KEY) ?? "{}") as Record<string, number>;
    const cutoff = Date.now() - SKIP_DAYS * 86_400_000;
    return Object.fromEntries(Object.entries(raw).filter(([, at]) => typeof at === "number" && at > cutoff));
  } catch {
    return {};
  }
}

function writeSkipped(skipped: Record<string, number>) {
  try {
    window.localStorage.setItem(SKIP_KEY, JSON.stringify(skipped));
  } catch {
    // Private window or blocked storage: skips last for this visit only.
  }
}

const CHANNEL_OPTIONS: { value: QueueChannel; label: string }[] = [
  { value: "any", label: "WhatsApp or email" },
  { value: "whatsapp", label: "WhatsApp only" },
  { value: "email", label: "Email only" },
];

async function send(url: string, method: "POST" | "PATCH", body: unknown): Promise<unknown> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error((result as { message?: string } | null)?.message ?? "Something went wrong.");
  return result;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";
}

export function OutreachQueue() {
  const [query, setQuery] = useState<QueueQuery>(DEFAULT_QUEUE_QUERY);
  const [mode, setMode] = useState<Mode>("fresh");
  const [queue, setQueue] = useState<Queue | null>(null);
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [skipped, setSkipped] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<"whatsapp" | "email" | null>(null);
  const [sentThisSession, setSentThisSession] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => setSkipped(readSkipped()), []);

  const params = useMemo(() => toQueueParams(query).toString(), [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ kind: "loading" });
    fetch(`/api/queue?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.message ?? "The queue could not be loaded.");
        setQueue(body as Queue);
        setLoad({ kind: "ready" });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoad({ kind: "error", message: err instanceof Error ? err.message : "The queue could not be loaded." });
      });
    return () => controller.abort();
  }, [params, reloadKey]);

  const fresh = useMemo(() => (queue?.fresh ?? []).filter((item) => !skipped[item.placeId]), [queue, skipped]);
  const followUps = queue?.followUps ?? [];
  const items = mode === "fresh" ? fresh : followUps;
  const current: QueueItem | undefined = items[0];
  const limitReached = queue !== null && queue.contactedToday >= queue.dailyLimit;

  const next = useCallback(
    (item: QueueItem) => {
      setQueue((q) =>
        q && {
          ...q,
          fresh: q.fresh.filter((i) => i.placeId !== item.placeId),
          followUps: q.followUps.filter((i) => i.placeId !== item.placeId),
        },
      );
      setOpened(null);
      setError(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [],
  );

  async function act(item: QueueItem, action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      next(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const markSent = (item: QueueItem) =>
    act(item, async () => {
      const result = (await send("/api/queue/sent", "POST", item.lead ? { leadId: item.lead.id } : { placeId: item.placeId })) as {
        contactedToday: number;
      };
      setQueue((q) => q && { ...q, contactedToday: result.contactedToday });
      setSentThisSession((n) => n + 1);
    });

  const skip = (item: QueueItem) => {
    if (item.kind === "first") {
      const updated = { ...skipped, [item.placeId]: Date.now() };
      setSkipped(updated);
      writeSkipped(updated);
    }
    next(item);
  };

  async function leadIdFor(item: QueueItem): Promise<string> {
    if (item.lead) return item.lead.id;
    const result = (await send("/api/leads", "POST", { placeId: item.placeId })) as { lead: Lead };
    return result.lead.id;
  }

  const hasWebsite = (item: QueueItem) =>
    act(item, async () => {
      await send("/api/leads", "POST", { placeId: item.placeId, notAFit: {} });
    });

  const doNotContact = (item: QueueItem) => {
    if (!window.confirm("Mark as Do not contact? It will never appear in the queue again.")) return;
    return act(item, async () => {
      await send(`/api/leads/${await leadIdFor(item)}`, "PATCH", { status: "do_not_contact" });
    });
  };

  const replied = (item: QueueItem) =>
    act(item, async () => {
      await send(`/api/leads/${await leadIdFor(item)}`, "PATCH", { status: "replied" });
    });

  const setFilter = <K extends keyof QueueQuery>(key: K, value: QueueQuery[K]) => setQuery((q) => ({ ...q, [key]: value }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Outreach queue"
        description="One business at a time with the draft ready. Open WhatsApp or email, send it yourself, then press Sent. Nothing is sent by the app."
        actions={
          queue && (
            <div className="text-right text-sm">
              <div className={cn("font-semibold", limitReached && "text-danger")}>
                {queue.contactedToday} / {queue.dailyLimit} first messages today
              </div>
              {sentThisSession > 0 && <div className="text-xs text-muted">{sentThisSession} sent this session</div>}
            </div>
          )
        }
      />

      <Card className="mt-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <SegmentedControl
            label="Queue"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setOpened(null);
              setError(null);
            }}
            options={[
              { value: "fresh", label: `New businesses${queue ? ` (${fresh.length})` : ""}` },
              { value: "followUps", label: `Follow-ups due${queue ? ` (${followUps.length})` : ""}` },
            ]}
          />
          <Field label="Category" className="min-w-40">
            <Select value={query.category ?? ""} onChange={(e) => setFilter("category", isCategoryGroup(e.target.value) ? e.target.value : null)}>
              <option value="">All categories</option>
              {Object.entries(CATEGORY_GROUPS).map(([key, group]) => (
                <option key={key} value={key}>
                  {group.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Minimum score" className="min-w-32">
            <Select value={query.minScore} onChange={(e) => setFilter("minScore", Number(e.target.value))}>
              {MIN_SCORE_OPTIONS.map((score) => (
                <option key={score} value={score}>
                  {score === 0 ? "Any" : `${score}+`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reach by" className="min-w-40">
            <Select value={query.channel} onChange={(e) => setFilter("channel", e.target.value as QueueChannel)}>
              {CHANNEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted">
          New businesses: your saved leads not contacted yet, then the best unsaved places (no chains, not already contacted
          under another listing with the same phone). Keep it personal and low-volume, and stop if anyone asks.
        </p>
      </Card>

      <div aria-live="polite" className="mt-6">
        {load.kind === "loading" && <Spinner label="Building the queue…" />}
        {load.kind === "error" && <Alert tone="danger">{load.message}</Alert>}
        {load.kind === "ready" && mode === "fresh" && limitReached && (
          <Alert tone="warning" className="mb-4">
            Daily limit reached ({queue!.dailyLimit} first messages). Follow-ups still work; new businesses wait until
            tomorrow. Change DAILY_OUTREACH_LIMIT in .env.local to adjust.
          </Alert>
        )}
        {load.kind === "ready" && !current && (
          <EmptyState
            title={mode === "fresh" ? "Queue done" : "No follow-ups due"}
            description={
              mode === "fresh"
                ? "Nothing left in this batch. Load more, or loosen the filters."
                : "Leads you contact get a reminder 4 days later, at most twice."
            }
            action={
              mode === "fresh" ? (
                <Button variant="primary" onClick={() => setReloadKey((k) => k + 1)}>
                  Load more
                </Button>
              ) : undefined
            }
          />
        )}
      </div>

      {load.kind === "ready" && current && (
        <QueueCard
          key={`${current.kind}:${current.placeId}`}
          item={current}
          position={`${items.length} left`}
          busy={busy}
          error={error}
          opened={opened}
          sentDisabled={current.kind === "first" && limitReached}
          onOpened={setOpened}
          onSent={() => markSent(current)}
          onSkip={() => skip(current)}
          onHasWebsite={() => hasWebsite(current)}
          onDoNotContact={() => doNotContact(current)}
          onReplied={() => replied(current)}
        />
      )}
    </main>
  );
}

function QueueCard({
  item,
  position,
  busy,
  error,
  opened,
  sentDisabled,
  onOpened,
  onSent,
  onSkip,
  onHasWebsite,
  onDoNotContact,
  onReplied,
}: {
  item: QueueItem;
  position: string;
  busy: boolean;
  error: string | null;
  opened: "whatsapp" | "email" | null;
  sentDisabled: boolean;
  onOpened: (channel: "whatsapp" | "email") => void;
  onSent: () => void;
  onSkip: () => void;
  onHasWebsite: () => void;
  onDoNotContact: () => void;
  onReplied: () => void;
}) {
  const { place, lead } = item;
  const name = lead?.label ?? place.name;
  const confirmedSentences = useMemo(
    () =>
      lead
        ? leadOpportunities(lead)
            .filter((o) => o.sentence && lead.confirmed_opportunities.includes(o.key))
            .map((o) => o.sentence!)
        : [],
    [lead],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card className="space-y-4 p-5">
        <div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span>{item.kind === "first" ? "First message" : "Follow-up"}</span>
            <span>{position}</span>
          </div>
          <h2 className="mt-1 text-xl leading-snug font-semibold" dir="auto">
            {name ?? "Unnamed business"}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <ScorePill score={place.lead_score} />
            <PresenceBadge presence={place.web_presence} />
            {place.has_instagram && <InstagramBadge />}
            {lead ? <LeadStatusBadge status={lead.lead_status} /> : <Badge tone="neutral">Not saved yet</Badge>}
          </div>
          <p className="mt-2 text-sm text-muted">
            {humanizeCategory(place.basic_category)} · {place.area}
          </p>
        </div>

        {item.kind === "follow_up" && lead && (
          <p className="text-sm">
            First contacted {formatDate(lead.first_contacted_at)}, last {formatDate(lead.last_contacted_at)}. Follow-ups
            sent: {lead.follow_up_count} of {MAX_FOLLOW_UPS}.
          </p>
        )}
        {lead?.operator_notes && (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm whitespace-pre-line" dir="auto">
            {lead.operator_notes}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {place.phones.map((phone) => {
            const href = telHref(phone);
            return href ? (
              <a key={phone} href={href} dir="ltr" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-xs font-medium hover:bg-surface-muted">
                <IconPhone />
                {phone}
              </a>
            ) : null;
          })}
          {place.emails.map((email) => {
            const href = mailtoHref(email);
            return href ? (
              <a key={email} href={href} dir="ltr" title={email} className="inline-flex h-8 max-w-56 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-xs font-medium hover:bg-surface-muted">
                <IconMail />
                <span className="truncate">{email}</span>
              </a>
            ) : null;
          })}
        </div>
        <SocialLinks urls={[...place.websites, ...place.socials]} />
        <div className="flex flex-wrap gap-2">
          <ExternalButtonLink size="sm" href={googleMapsSearchUrl(place.name, place.area, place.lat, place.lon)}>
            <IconExternal />
            Check on Google Maps
          </ExternalButtonLink>
          <ButtonLink size="sm" href={`/?place=${encodeURIComponent(item.placeId)}&lat=${place.lat}&lon=${place.lon}`}>
            <IconMapPin />
            Show on map
          </ButtonLink>
          {lead && (
            <ButtonLink size="sm" href={`/leads?lead=${lead.id}`}>
              Open lead
            </ButtonLink>
          )}
        </div>
        <p className="text-xs text-muted">
          Tip: a quick look on Google Maps shows whether they already have a website. If they do, press “Has a website”.
        </p>
      </Card>

      <Card className="p-5">
        <OutreachDraft
          phones={place.phones}
          emails={place.emails}
          name={name}
          confirmedSentences={confirmedSentences}
          defaultKind={item.kind}
          category={categoryGroupOf(place.basic_category)}
          pitchType={pitchTypeOf(place.basic_category)}
          onSendOpened={onOpened}
        />

        {/* Stays in view while scrolling the draft. */}
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 flex flex-wrap items-center gap-2 rounded-b-xl border-t border-border bg-surface px-5 py-4">
          <Button
            variant="primary"
            disabled={busy || sentDisabled}
            onClick={onSent}
            className={cn(opened && "ring-2 ring-primary/40")}
            title={sentDisabled ? "Daily limit reached" : "Records today's contact and sets a follow-up reminder"}
          >
            <IconCheck />
            Sent → next
          </Button>
          <Button disabled={busy} onClick={onSkip}>
            Skip
          </Button>
          {item.kind === "first" ? (
            <Button disabled={busy} onClick={onHasWebsite}>
              Has a website
            </Button>
          ) : (
            <Button disabled={busy} onClick={onReplied}>
              They replied
            </Button>
          )}
          <Button variant="danger" disabled={busy} onClick={onDoNotContact}>
            Do not contact
          </Button>
          {opened && !error && (
            <InlineMessage tone="muted">
              Sent it in {opened === "whatsapp" ? "WhatsApp" : "your mail app"}? Press Sent.
            </InlineMessage>
          )}
          {error && <InlineMessage tone="danger">{error}</InlineMessage>}
        </div>
      </Card>
    </div>
  );
}
