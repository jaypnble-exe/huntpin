"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  canDraftOutreach,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  MAX_LABEL_LENGTH,
  MAX_NOTES_LENGTH,
  type LeadStatus,
} from "@/lib/leads/leads";
import { humanizeCategory } from "@/lib/places/categories";
import { googleMapsCoordinatesUrl, safeHref, telHref } from "@/lib/places/links";
import type { Lead } from "@/lib/server/leadsStore";
import { PRESENCE_STYLES } from "../placeStyles";
import { OutreachDraft } from "./OutreachDraft";
import { WebsiteCheck } from "./WebsiteCheck";

const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5";

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

export function LeadEditor({
  lead,
  onClose,
  onSaved,
  onDeleted,
}: {
  lead: Lead;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
  onDeleted: (id: string) => void;
}) {
  const [label, setLabel] = useState(lead.label ?? "");
  const [status, setStatus] = useState<LeadStatus>(lead.lead_status);
  const [notes, setNotes] = useState(lead.operator_notes ?? "");
  const [firstContacted, setFirstContacted] = useState(toDateInput(lead.first_contacted_at));
  const [lastContacted, setLastContacted] = useState(toDateInput(lead.last_contacted_at));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function applyLead(updated: Lead) {
    setStatus(updated.lead_status);
    setFirstContacted(toDateInput(updated.first_contacted_at));
    setLastContacted(toDateInput(updated.last_contacted_at));
    onSaved(updated);
  }

  async function patch(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message ?? "Could not save.");
      applyLead(result.lead as Lead);
      setMessage({ kind: "ok", text: success });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    patch(
      {
        label,
        status,
        notes,
        firstContactedOn: firstContacted || null,
        lastContactedOn: lastContacted || null,
      },
      "Saved.",
    );
  };

  async function remove() {
    if (!window.confirm("Delete this lead? Its status, notes and contact dates will be lost.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json())?.message ?? "Could not delete.");
      onDeleted(lead.id);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not delete." });
      setBusy(false);
    }
  }

  const place = lead.place;
  const presence = place ? PRESENCE_STYLES[place.web_presence] : null;

  return (
    <aside
      aria-label="Lead details"
      className="fixed inset-x-0 bottom-0 z-30 max-h-[85dvh] overflow-y-auto rounded-t-xl bg-white p-4 text-sm text-neutral-900 shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[28rem] sm:rounded-none"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold" dir="auto">
          {lead.label ?? place?.name ?? "Lead"}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close lead" className="rounded px-2 text-xl leading-none">
          ×
        </button>
      </div>

      {place && (
        <div className="mt-1 space-y-2">
          <p className="text-neutral-600">
            {humanizeCategory(place.basic_category)} · {place.area}
            {presence && (
              <>
                {" · "}
                <span style={{ color: presence.color }} className="font-medium">
                  {presence.label}
                </span>
              </>
            )}
            {place.has_instagram && <span className="text-pink-700"> · Instagram</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/?place=${encodeURIComponent(lead.overture_place_id ?? "")}&lat=${place.lat}&lon=${place.lon}`}
              className="rounded-md border border-neutral-300 px-2.5 py-1"
            >
              Show on map
            </Link>
            <a
              href={googleMapsCoordinatesUrl(place.lat, place.lon)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-neutral-300 px-2.5 py-1"
            >
              Google Maps<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
          <ul className="space-y-0.5">
            {[...place.websites, ...place.socials].map((url) => {
              const href = safeHref(url);
              return (
                <li key={url} className="break-all">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-blue-700 underline">
                      {url}
                    </a>
                  ) : (
                    url
                  )}
                </li>
              );
            })}
            {place.phones.map((phone) => {
              const href = telHref(phone);
              return (
                <li key={phone} dir="ltr">
                  {href ? (
                    <a href={href} className="text-blue-700 underline">
                      {phone}
                    </a>
                  ) : (
                    phone
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form onSubmit={save} className="mt-4 space-y-3 border-t border-neutral-200 pt-4">
        <label className="block font-medium">
          Label
          <input
            className={inputClass}
            dir="auto"
            maxLength={MAX_LABEL_LENGTH}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label className="block font-medium">
          Status
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block font-medium">
          Notes
          <textarea
            className={`${inputClass} min-h-24`}
            dir="auto"
            maxLength={MAX_NOTES_LENGTH}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block font-medium">
            First contacted
            <input type="date" className={inputClass} value={firstContacted} onChange={(e) => setFirstContacted(e.target.value)} />
          </label>
          <label className="block font-medium">
            Last contacted
            <input type="date" className={inputClass} value={lastContacted} onChange={(e) => setLastContacted(e.target.value)} />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white disabled:opacity-50">
            Save
          </button>
          {status !== "do_not_contact" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => patch({ markContacted: true }, "Marked as contacted today.")}
              className="rounded-md border border-neutral-300 px-3 py-1.5 disabled:opacity-50"
            >
              Mark contacted today
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="ml-auto rounded-md px-3 py-1.5 text-red-700 underline disabled:opacity-50"
          >
            Delete lead
          </button>
        </div>
        {message && (
          <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-red-700" : "text-green-700"}>
            {message.text}
          </p>
        )}
      </form>

      <div className="mt-4 border-t border-neutral-200 pt-4">
        <WebsiteCheck lead={lead} onChecked={applyLead} />
      </div>

      <div className="mt-4 border-t border-neutral-200 pt-4">
        {canDraftOutreach(status) ? (
          <OutreachDraft phones={place?.phones ?? []} />
        ) : (
          <p className="text-neutral-600">
            No outreach drafts for leads marked “{LEAD_STATUS_LABELS[status]}”.
          </p>
        )}
      </div>
    </aside>
  );
}
