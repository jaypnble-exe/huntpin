import Link from "next/link";
import { LEAD_STATUS_LABELS, LEAD_STATUSES } from "@/lib/leads/leads";
import { computeWeeklySummary, type WeeklySummary } from "@/lib/leads/weeklySummary";
import { humanizeCategory } from "@/lib/places/categories";
import { getSummaryLeads, getSuggestedPlaces, type SuggestedPlace } from "@/lib/server/summaryStore";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { PRESENCE_STYLES } from "../placeStyles";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
      <dt className="text-sm opacity-70">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
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
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold">Weekly summary</h1>
        <p role="alert" className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm">
          The summary could not be loaded. Check Supabase and that all migrations have been run.
        </p>
      </main>
    );
  }

  const week = summary.thisWeek;
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Weekly summary</h1>
      <p className="text-sm opacity-80">
        {summary.from} to {summary.to} · {summary.totalLeads} saved lead{summary.totalLeads === 1 ? "" : "s"} in total
      </p>

      <h2 className="mt-6 font-semibold">This week</h2>
      <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Leads saved" value={week.saved} />
        <Stat label="First messages" value={week.firstContacts} />
        <Stat label="Follow-ups sent" value={week.followUpsSent} />
        <Stat label="Replies" value={week.replies} />
        <Stat label="Declined / opted out" value={week.declined} />
      </dl>

      <h2 className="mt-6 font-semibold">Follow-ups</h2>
      <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label="Due now"
          value={
            summary.followUps.dueNow > 0 ? (
              <Link href="/leads" className="text-red-700 underline">
                {summary.followUps.dueNow}
              </Link>
            ) : (
              0
            )
          }
        />
        <Stat label="Due in the next 7 days" value={summary.followUps.nextSevenDays} />
        <Stat
          label="Reply rate (all time)"
          value={summary.replyRate === null ? "—" : `${Math.round(summary.replyRate * 100)}%`}
        />
      </dl>

      <h2 className="mt-6 font-semibold">Pipeline</h2>
      <ul className="mt-2 flex flex-wrap gap-2 text-sm">
        {LEAD_STATUSES.map((status) => (
          <li key={status} className="rounded-full border border-black/10 px-3 py-1 dark:border-white/15">
            {LEAD_STATUS_LABELS[status]} <strong className="tabular-nums">{summary.pipeline[status]}</strong>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 font-semibold">Suggested next: best places not saved yet</h2>
      {suggestions.length === 0 ? (
        <p className="mt-2 text-sm opacity-80">No suggestions. Import places first.</p>
      ) : (
        <ol className="mt-2 divide-y divide-black/10 text-sm dark:divide-white/10">
          {suggestions.map((place) => (
            <li key={place.id} className="flex items-center gap-3 py-2">
              <span className="w-9 rounded bg-neutral-900 text-center text-xs font-semibold text-white">{place.lead_score}</span>
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: PRESENCE_STYLES[place.web_presence].color }} />
              <bdi className="min-w-0 flex-1 truncate">{place.name ?? "Unnamed"}</bdi>
              <span className="hidden opacity-70 sm:inline">{humanizeCategory(place.basic_category)}</span>
              <Link
                href={`/?place=${encodeURIComponent(place.id)}&lat=${place.lat}&lon=${place.lon}`}
                className="underline"
              >
                Show on map
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
