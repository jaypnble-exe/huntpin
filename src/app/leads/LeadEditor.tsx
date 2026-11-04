"use client";

import { useMemo, useState } from "react";
import { InstagramBadge, LeadStatusBadge, PresenceBadge, ScorePill } from "@/components/leads/LeadBadges";
import Link from "next/link";
import {
  Button,
  Drawer,
  Field,
  IconCheck,
  IconExternal,
  IconMapPin,
  IconTrash,
  InlineMessage,
  Input,
  Section,
  Select,
} from "@/components/ui";
import { wantsFollowUp } from "@/lib/leads/followUps";
import {
  canDraftOutreach,
  DEAL_CURRENCY,
  isDealStage,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  MAX_DEAL_VALUE,
  type LeadStatus,
} from "@/lib/leads/leads";
import { categoryGroupOf, humanizeCategory } from "@/lib/places/categories";
import { googleMapsSearchUrl } from "@/lib/places/links";
import type { Lead } from "@/lib/server/leadsStore";
import { hasKnownWebsite } from "@/lib/leads/outreach";
import { pitchTypeOf } from "@/lib/leads/pitchTypes";
import { LeadActivity } from "./LeadActivity";
import { LeadContact } from "./LeadContact";
import { OutreachDraft } from "./OutreachDraft";
import { leadOpportunities, WebsiteCheck } from "./WebsiteCheck";

function toValueInput(value: number | null): string {
  return value === null ? "" : String(value);
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
  const [status, setStatus] = useState<LeadStatus>(lead.lead_status);
  const [followUpOn, setFollowUpOn] = useState(lead.follow_up_on ?? "");
  const [dealValue, setDealValue] = useState(toValueInput(lead.deal_value));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function applyLead(updated: Lead) {
    setStatus(updated.lead_status);
    setFollowUpOn(updated.follow_up_on ?? "");
    setDealValue(toValueInput(updated.deal_value));
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
        status,
        followUpOn: followUpOn || null,
        dealValue: dealValue.trim() === "" ? null : Number(dealValue),
      },
      "Saved.",
    );
  };
  const dirty =
    status !== lead.lead_status ||
    followUpOn !== (lead.follow_up_on ?? "") ||
    dealValue !== toValueInput(lead.deal_value);

  async function remove() {
    if (!window.confirm("Delete this lead? Its status and contact history will be lost.")) return;
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
  const confirmedSentences = useMemo(
    () =>
      leadOpportunities(lead)
        .filter((o) => o.sentence && lead.confirmed_opportunities.includes(o.key))
        .map((o) => o.sentence!),
    [lead],
  );
  const links = place ? [...place.websites, ...place.socials] : [];

  return (
    <Drawer
      label="Lead details"
      title={lead.label ?? place?.name ?? "Lead"}
      onClose={onClose}
      dismissOnOutsideClick
      footer={
        <form onSubmit={save} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            {isDealStage(status) ? (
              <Field label={`Deal value (${DEAL_CURRENCY})`}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={MAX_DEAL_VALUE}
                  step="any"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                />
              </Field>
            ) : (
              wantsFollowUp(status) && (
                <Field label="Next follow-up">
                  <Input type="date" value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} />
                </Field>
              )
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status !== "do_not_contact" && (
              <Button
                variant={dirty ? "secondary" : "primary"}
                disabled={busy}
                onClick={() =>
                  patch({ markContacted: true }, lead.first_contacted_at ? "Marked as followed up today." : "Marked as contacted today.")
                }
              >
                <IconCheck />
                {lead.first_contacted_at ? "Mark followed up today" : "Mark contacted today"}
              </Button>
            )}
            {dirty && (
              <Button type="submit" variant="primary" disabled={busy}>
                Save
              </Button>
            )}
            {message && <InlineMessage tone={message.kind === "error" ? "danger" : "success"}>{message.text}</InlineMessage>}
          </div>
        </form>
      }
      subtitle={
        <div className="space-y-2">
          {place && (
            <p>
              {humanizeCategory(place.basic_category)} · {place.area}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {place && (
              <span className="inline-flex">
                <span className="sr-only">Lead score </span>
                <ScorePill score={place.lead_score} />
              </span>
            )}
            <LeadStatusBadge status={lead.lead_status} />
            {place && <PresenceBadge presence={place.web_presence} />}
            {place?.has_instagram && <InstagramBadge />}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {place && (
          <nav aria-label="Find this business" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Link
              href={`/?place=${encodeURIComponent(lead.overture_place_id ?? "")}&lat=${place.lat}&lon=${place.lon}`}
              className="inline-flex items-center gap-1.5 font-medium text-info hover:underline"
            >
              <IconMapPin />
              Show on map
            </Link>
            <a
              href={googleMapsSearchUrl(place.name, place.area, place.lat, place.lon)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-info hover:underline"
            >
              <IconExternal />
              Find on Google Maps
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </nav>
        )}

        {place && <LeadContact phones={place.phones} emails={place.emails ?? []} links={links} />}

        <div className={place ? "border-t border-border pt-5" : undefined}>
          <LeadActivity lead={lead} />
        </div>

        <div className="border-t border-border pt-5">
          <WebsiteCheck lead={lead} onChecked={applyLead} />
        </div>

        <div className="border-t border-border pt-5">
          {canDraftOutreach(status) ? (
            <OutreachDraft
              phones={place?.phones ?? []}
              emails={place?.emails ?? []}
              category={categoryGroupOf(place?.basic_category ?? null)}
              pitchType={pitchTypeOf(place?.basic_category ?? null)}
              hasWebsite={hasKnownWebsite(place?.web_presence, lead.website_url)}
              name={lead.label?.trim() || place?.name || null}
              confirmedSentences={confirmedSentences}
              defaultKind={lead.first_contacted_at ? "follow_up" : "first"}
            />
          ) : (
            <Section title="Outreach draft">
              <p className="text-sm text-muted">No drafts for leads marked “{LEAD_STATUS_LABELS[status]}”.</p>
            </Section>
          )}
        </div>

        <div className="border-t border-border pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:pointer-events-none disabled:opacity-50"
          >
            <IconTrash className="h-3.5 w-3.5" />
            Delete lead
          </button>
        </div>
      </div>
    </Drawer>
  );
}
