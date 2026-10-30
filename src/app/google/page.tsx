import { Alert, Card, PageHeader, Stat } from "@/components/ui";
import { getUsageStatus } from "@/lib/server/status";
import { PauseToggle } from "./PauseToggle";
import { SearchPanel } from "./SearchPanel";

export const dynamic = "force-dynamic";

export default async function GoogleSearchPage() {
  const status = await getUsageStatus();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Google search"
        description="Optional and off by default. The map uses free open data; this page is only for occasional Google Places searches."
      />

      <Alert tone="warning" title="Google API cost notice" className="mt-6">
        Google Places requests may incur charges. This app limits its own requests, but it cannot see other apps on your
        billing account, and Google budget alerts only notify you; they do not stop spending. Set a per-day quota in
        Google Cloud Console as the hard cap. See <code>docs/SETUP.md</code>.
      </Alert>

      {!status.configOk && (
        <Alert tone="danger" title="Configuration errors (searches refused)" className="mt-4">
          <ul className="list-disc pl-5">
            {status.configErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Card className="mt-6 p-5">
        <SearchPanel
          blockedReason={status.searchBlockedReason}
          maxResultsPerSearch={status.maxResultsPerSearch ?? 1}
          sku={status.sku}
          freeCap={status.googleFreeMonthlyCap}
          used={status.used}
          limit={status.limit}
        />
      </Card>

      <h2 className="mt-8 text-sm font-semibold">Usage and safeguards</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Requests this month"
          value={status.used === null || status.limit === null ? "—" : `${status.used} / ${status.limit}`}
          hint={status.remaining === null ? "usage tracking unavailable" : `${status.remaining} remaining (UTC month)`}
        />
        <Stat label="Max results per search" value={status.maxResultsPerSearch ?? "—"} />
        <Stat label="Field tier" value={status.fieldTier ?? "—"} hint={status.sku ?? undefined} />
      </dl>
      <p className="mt-3 text-xs text-muted">
        Search status: {status.searchBlockedReason ?? "enabled."} Google lists the free cap for this SKU as{" "}
        {status.googleFreeMonthlyCap ?? "unknown"}; verify before use.
      </p>

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Search pause</h2>
          <p className="text-xs text-muted">
            {status.paused ? "Searches are paused. No Google requests will be made." : "Searches are not paused."}
          </p>
        </div>
        <PauseToggle paused={status.paused} />
      </Card>
    </main>
  );
}
