import { LeadStatusBadge, PresenceBadge, ScorePill } from "@/components/leads/LeadBadges";
import { Alert, ButtonLink, Card, EmptyState, IconMapPin, PageHeader, Stat } from "@/components/ui";
import { LEAD_STATUSES } from "@/lib/leads/leads";
import { computeWeeklySummary, type WeeklySummary } from "@/lib/leads/weeklySummary";
import { humanizeCategory } from "@/lib/places/categories";
import { getSummaryLeads, getSuggestedPlaces, type SuggestedPlace } from "@/lib/server/summaryStore";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

export default async function SummaryPage() {
  let summary: WeeklySummary;
  let suggestions: SuggestedPlace[];
  try {
    const supabase = getSupabaseAdmin();
    const [leads, places] = await Promise.all([getSummaryLeads(supabase), getSuggestedPlaces(supabase)]);
    summary = computeWeeklySummary(leads, new Date(), process.env.APP_TIME_ZONE || undefined);
    suggestions = places;
  } catch {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <PageHeader title="Weekly summary" />
        <Alert tone="danger" className="mt-6">
          The summary could not be loaded. Check Supabase and that all migrations have been run.
        </Alert>
      </main>
    );
  }

  const week = summary.thisWeek;
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Weekly summary"
        description={`${formatDay(summary.from)} – ${formatDay(summary.to)} · ${summary.totalLeads} saved lead${summary.totalLeads === 1 ? "" : "s"} in total`}
        actions={
          summary.followUps.dueNow > 0 ? (
            <ButtonLink href="/leads" variant="primary">
              {summary.followUps.dueNow} follow-up{summary.followUps.dueNow === 1 ? "" : "s"} due
            </ButtonLink>
          ) : undefined
        }
      />

      <h2 className="mt-8 text-sm font-semibold">This week</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Leads saved" value={week.saved} />
        <Stat label="First messages" value={week.firstContacts} />
        <Stat label="Follow-ups sent" value={week.followUpsSent} />
        <Stat label="Replies" value={week.replies} tone={week.replies > 0 ? "success" : undefined} />
        <Stat label="Declined" value={week.declined} hint="incl. do not contact" />
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold">Follow-ups</h2>
            <dl className="mt-3 grid grid-cols-3 gap-3">
              <Stat label="Due now" value={summary.followUps.dueNow} tone={summary.followUps.dueNow > 0 ? "danger" : undefined} />
              <Stat label="Next 7 days" value={summary.followUps.nextSevenDays} />
              <Stat
                label="Reply rate"
                value={summary.replyRate === null ? "—" : `${Math.round(summary.replyRate * 100)}%`}
                hint="all time"
              />
            </dl>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Pipeline</h2>
            <Card className="mt-3 divide-y divide-border">
              {LEAD_STATUSES.map((status) => (
                <div key={status} className="flex items-center justify-between px-4 py-2.5">
                  <LeadStatusBadge status={status} />
                  <span className="font-semibold tabular-nums">{summary.pipeline[status]}</span>
                </div>
              ))}
            </Card>
          </section>
        </div>

        <section>
          <h2 className="text-sm font-semibold">Suggested next</h2>
          <p className="mt-0.5 text-xs text-muted">Best-scoring places you haven&apos;t saved yet (chains excluded).</p>
          {suggestions.length === 0 ? (
            <EmptyState className="mt-3" title="No suggestions" description="Import places first." />
          ) : (
            <Card className="mt-3 divide-y divide-border">
              {suggestions.map((place) => (
                <div key={place.id} className="flex items-center gap-3 px-4 py-3">
                  <ScorePill score={place.lead_score} />
                  <div className="min-w-0 flex-1">
                    <bdi className="block truncate text-sm font-medium">{place.name ?? "Unnamed"}</bdi>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <PresenceBadge presence={place.web_presence} />
                      {humanizeCategory(place.basic_category)}
                    </div>
                  </div>
                  <ButtonLink
                    size="sm"
                    href={`/?place=${encodeURIComponent(place.id)}&lat=${place.lat}&lon=${place.lon}`}
                    aria-label={`Show ${place.name ?? "place"} on the map`}
                  >
                    <IconMapPin />
                    Map
                  </ButtonLink>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
