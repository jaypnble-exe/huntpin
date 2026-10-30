"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { SearchResponseBody } from "@/lib/server/search";
import { googleMapsPlaceUrl } from "@/lib/mapsUrl";
import { buildTextQuery, LOCATION_LENGTH, NICHE_LENGTH } from "@/lib/searchLimits";
import { Alert, Button, ExternalButtonLink, Field, IconExternal, IconSearch, Input, Spinner } from "@/components/ui";

type SearchSuccess = Extract<SearchResponseBody, { ok: true }>;

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; query: string; result: SearchSuccess };

export interface SearchPanelProps {
  blockedReason: string | null;
  maxResultsPerSearch: number;
  sku: string | null;
  freeCap: string | null;
  used: number | null;
  limit: number | null;
}

export function SearchPanel({
  blockedReason,
  maxResultsPerSearch,
  sku,
  freeCap,
  used,
  limit,
}: SearchPanelProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState(maxResultsPerSearch);
  const [state, setState] = useState<SearchState>({ kind: "idle" });

  const loading = state.kind === "loading";
  const query = buildTextQuery(niche, location);

  // Submitting the form only opens the confirmation. No request is made here.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blockedReason || loading) return;
    dialogRef.current?.showModal();
  }

  async function runConfirmedSearch() {
    dialogRef.current?.close();
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, location, maxResults, confirmed: true }),
      });
      const body = (await response.json()) as SearchResponseBody;
      if (body.ok) {
        setState({ kind: "success", query, result: body });
      } else {
        const details = body.details?.length ? ` ${body.details.join("; ")}.` : "";
        setState({ kind: "error", message: `${body.message}${details}` });
      }
    } catch {
      setState({ kind: "error", message: "Could not reach the server." });
    } finally {
      // Refresh the server-rendered usage counter.
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="search-heading">
      <h2 id="search-heading" className="text-base font-semibold">
        Find businesses
      </h2>

      <form onSubmit={handleSubmit} className="mt-3 grid gap-4 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end">
        <Field label="Niche / business type">
          <Input
            name="niche"
            required
            minLength={NICHE_LENGTH.min}
            maxLength={NICHE_LENGTH.max}
            placeholder="restaurants and cafés"
            value={niche}
            onChange={(event) => setNiche(event.target.value)}
          />
        </Field>
        <Field label="City or location">
          <Input
            name="location"
            required
            minLength={LOCATION_LENGTH.min}
            maxLength={LOCATION_LENGTH.max}
            placeholder="Jeddah, Saudi Arabia"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </Field>
        <Field label="Max results">
          <Input
            name="maxResults"
            type="number"
            required
            min={1}
            max={maxResultsPerSearch}
            step={1}
            value={maxResults}
            onChange={(event) => setMaxResults(Number(event.target.value))}
          />
        </Field>
        <Button type="submit" variant="primary" disabled={Boolean(blockedReason) || loading}>
          <IconSearch />
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {blockedReason && (
        <p className="mt-2 text-sm text-muted">Search unavailable: {blockedReason}</p>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="confirm-heading"
        className="m-auto max-w-md rounded-2xl border border-border bg-surface p-6 text-foreground shadow-2xl backdrop:bg-black/50"
      >
        <h3 id="confirm-heading" className="text-lg font-semibold">
          Run a real Google search?
        </h3>
        <dl className="mt-3 space-y-1 text-sm">
          <div>
            <dt className="inline font-medium">Query: </dt>
            <dd className="inline">{query}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Max results: </dt>
            <dd className="inline">{maxResults}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Google SKU: </dt>
            <dd className="inline">
              {sku ?? "Unknown"} (Google lists the free cap as {freeCap ?? "unknown"})
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">App usage after this: </dt>
            <dd className="inline">
              {used !== null && limit !== null ? `${used + 1} of ${limit} this month` : "Unknown"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm">
          This sends exactly one request to Google Places API. It counts toward
          the app limit even if it fails. Check your billing report to confirm
          the actual cost.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button onClick={() => dialogRef.current?.close()}>Cancel</Button>
          <Button variant="primary" onClick={runConfirmedSearch}>
            Run 1 Google search
          </Button>
        </div>
      </dialog>

      <div aria-live="polite" className="mt-6">
        {state.kind === "loading" && <Spinner label="Searching…" />}
        {state.kind === "error" && <Alert tone="danger">{state.message}</Alert>}
        {state.kind === "success" && <Results query={state.query} result={state.result} />}
      </div>
    </section>
  );
}

function Results({ query, result }: { query: string; result: SearchSuccess }) {
  const idsOnly = result.fieldTier === "ids_only";
  return (
    <div>
      <p className="text-sm">
        {result.places.length} result{result.places.length === 1 ? "" : "s"} for “{query}”.
        App usage: {result.usage.used} of {result.usage.limit} this month. Results
        are not saved yet.
      </p>
      {idsOnly && (
        <p className="mt-1 text-sm text-muted">
          ID-only mode: Google returned place IDs but no names or addresses. Open
          each place in Google Maps to see the business.
        </p>
      )}

      {result.places.length === 0 ? (
        <p className="mt-4 text-sm">No places matched this search.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th scope="col" className="py-2 pr-4">#</th>
                <th scope="col" className="py-2 pr-4">Business</th>
                <th scope="col" className="py-2 pr-4">Address</th>
                <th scope="col" className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.places.map((place, index) => (
                <tr key={place.placeId} className="border-b border-border">
                  <td className="py-2 pr-4 align-top">{index + 1}</td>
                  <td className="py-2 pr-4 align-top">
                    {place.displayName ?? <span className="text-muted">Not requested</span>}
                    <div className="font-mono text-xs break-all text-muted">{place.placeId}</div>
                  </td>
                  <td className="py-2 pr-4 align-top">
                    {place.formattedAddress ?? <span className="text-muted">Not requested</span>}
                  </td>
                  <td className="py-2 align-top">
                    <ExternalButtonLink size="sm" href={googleMapsPlaceUrl(place.placeId, place.displayName ?? query)}>
                      <IconExternal />
                      Open in Google Maps
                    </ExternalButtonLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Required attribution when showing Places data without a Google map. */}
      <p
        translate="no"
        className="mt-3 text-right text-sm font-normal whitespace-nowrap text-[#5E5E5E] dark:text-white"
        style={{ fontFamily: "Roboto, sans-serif" }}
      >
        Google Maps
      </p>
    </div>
  );
}
