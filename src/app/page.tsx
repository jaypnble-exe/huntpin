import { getUsageStatus } from "@/lib/server/status";
import { PauseToggle } from "./PauseToggle";
import { SearchPanel } from "./SearchPanel";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
      <dt className="text-sm opacity-70">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}

export default async function Home() {
  const status = await getUsageStatus();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Client Finder</h1>

      <section
        aria-labelledby="cost-notice"
        className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm"
      >
        <h2 id="cost-notice" className="font-semibold">
          Google API cost notice
        </h2>
        <p className="mt-1">
          Google Places requests may incur charges. This app limits its own
          requests, but it cannot see other apps on your billing account, and
          Google budget alerts only notify you; they do not stop spending. Set a
          per-day quota in Google Cloud Console as the hard cap. See{" "}
          <code>docs/SETUP.md</code>.
        </p>
      </section>

      {!status.configOk && (
        <section role="alert" className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm">
          <h2 className="font-semibold">Configuration errors (searches refused)</h2>
          <ul className="mt-1 list-disc pl-5">
            {status.configErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      )}

      <SearchPanel
        blockedReason={status.searchBlockedReason}
        maxResultsPerSearch={status.maxResultsPerSearch ?? 1}
        sku={status.sku}
        freeCap={status.googleFreeMonthlyCap}
        used={status.used}
        limit={status.limit}
      />

      <h2 className="mt-10 text-lg font-semibold">Usage and safeguards</h2>
      <dl className="mt-3 grid gap-4 sm:grid-cols-2">
        <Stat label="Places search" value={status.searchBlockedReason ?? "Enabled"} />
        <Stat
          label="App-tracked requests this month (UTC, stored in Supabase)"
          value={
            status.used === null || status.limit === null
              ? "Unavailable"
              : `${status.used} of ${status.limit} used, ${status.remaining} remaining`
          }
        />
        <Stat
          label="Field tier / SKU"
          value={status.sku ? `${status.fieldTier}: ${status.sku}` : "Unknown"}
        />
        <Stat
          label="Google free cap for this SKU (verify before use)"
          value={status.googleFreeMonthlyCap ?? "Unknown"}
        />
        <Stat label="Max results per search" value={status.maxResultsPerSearch ?? "Unknown"} />
      </dl>

      <section aria-labelledby="pause-heading" className="mt-6">
        <h2 id="pause-heading" className="font-semibold">
          Search pause
        </h2>
        <p className="mt-1 mb-3 text-sm opacity-80">
          {status.paused
            ? "Searches are paused. No Google requests will be made."
            : "Searches are not paused."}
        </p>
        <PauseToggle paused={status.paused} />
      </section>
    </main>
  );
}
