"use client";

import { useMemo, useState } from "react";
import { InstagramBadge, LeadStatusBadge, PresenceBadge, ScorePill } from "@/components/leads/LeadBadges";
import {
  Button,
  ButtonLink,
  Drawer,
  ExternalButtonLink,
  Field,
  IconCheck,
  IconExternal,
  IconMail,
  IconMapPin,
  IconPhone,
  IconTrash,
  InlineMessage,
  Input,
  Section,
  Select,
  Textarea,
} from "@/components/ui";
import { FOLLOW_UP_AFTER_DAYS, MAX_FOLLOW_UPS, wantsFollowUp } from "@/lib/leads/followUps";
import {
  canDraftOutreach,
  DEAL_CURRENCY,
  isDealStage,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  MAX_DEAL_VALUE,
  MAX_LABEL_LENGTH,
  MAX_NOTES_LENGTH,
  type LeadStatus,
} from "@/lib/leads/leads";
import { categoryGroupOf, humanizeCategory } from "@/lib/places/categories";
import { googleMapsSearchUrl, telHref } from "@/lib/places/links";
import { SocialLinks } from "@/components/leads/SocialLinks";
import { mailtoHref } from "@/lib/places/emails";
import type { Lead } from "@/lib/server/leadsStore";
import { OutreachDraft } from "./OutreachDraft";
import { leadOpportunities, WebsiteCheck } from "./WebsiteCheck";

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

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
  const [label, setLabel] = useState(lead.label ?? "");
  const [status, setStatus] = useState<LeadStatus>(lead.lead_status);
  const [notes, setNotes] = useState(lead.operator_notes ?? "");
  const [firstContacted, setFirstContacted] = useState(toDateInput(lead.first_contacted_at));
  const [lastContacted, setLastContacted] = useState(toDateInput(lead.last_contacted_at));
  const [followUpOn, setFollowUpOn] = useState(lead.follow_up_on ?? "");
  const [dealValue, setDealValue] = useState(toValueInput(lead.deal_value));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function applyLead(updated: Lead) {
    setStatus(updated.lead_status);
    setFirstContacted(toDateInput(updated.first_contacted_at));
    setLastContacted(toDateInput(updated.last_contacted_at));
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
        label,
        status,
        notes,
        firstContactedOn: firstContacted || null,
        lastContactedOn: lastContacted || null,
        followUpOn: followUpOn || null,
        dealValue: dealValue.trim() === "" ? null : Number(dealValue),
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
      subtitle={
        <div className="flex flex-wrap items-center gap-1.5">
          {place && <ScorePill score={place.lead_score} />}
          <LeadStatusBadge status={lead.lead_status} />
          {place && <PresenceBadge presence={place.web_presence} />}
          {place?.has_instagram && <InstagramBadge />}
          {place && (
            <span className="text-xs">
              {humanizeCategory(place.basic_category)} · {place.area}
            </span>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {place && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <ButtonLink
                size="sm"
                href={`/?place=${encodeURIComponent(lead.overture_place_id ?? "")}&lat=${place.lat}&lon=${place.lon}`}
              >
                <IconMapPin />
                Show on map
              </ButtonLink>
              <ExternalButtonLink size="sm" href={googleMapsSearchUrl(place.name, place.area, place.lat, place.lon)}>
                <IconExternal />
                Google Maps
              </ExternalButtonLink>
              {place.phones.map((phone) => {
                const href = telHref(phone);
                return href ? (
                  <a key={phone} href={href} dir="ltr" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-xs font-medium hover:bg-surface-muted">
                    <IconPhone />
                    {phone}
                  </a>
                ) : null;
              })}
              {(place.emails ?? []).map((email) => {
                const href = mailtoHref(email);
                return href ? (
                  <a key={email} href={href} dir="ltr" title={email} className="inline-flex h-8 max-w-56 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-xs font-medium hover:bg-surface-muted">
                    <IconMail />
                    <span className="truncate">{email}</span>
                  </a>
                ) : null;
              })}
            </div>
            <SocialLinks urls={links} />
          </div>
        )}

        <Section title="Status & notes">
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Label">
                <Input dir="auto" maxLength={MAX_LABEL_LENGTH} value={label} onChange={(e) => setLabel(e.target.value)} />
              </Field>
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                className="min-h-20"
                dir="auto"
                maxLength={MAX_NOTES_LENGTH}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First contacted">
                <Input type="date" value={firstContacted} onChange={(e) => setFirstContacted(e.target.value)} />
              </Field>
              <Field label="Last contacted">
                <Input type="date" value={lastContacted} onChange={(e) => setLastContacted(e.target.value)} />
              </Field>
            </div>
            {isDealStage(status) && (
              <Field
                label={`Deal value (${DEAL_CURRENCY})`}
                hint={
                  lead.closed_at && (status === "won" || status === "lost")
                    ? `${status === "won" ? "Won" : "Lost"} on ${new Date(lead.closed_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}.`
                    : "Expected or agreed project value. Shown on the Pipeline page."
                }
              >
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
            )}
            {wantsFollowUp(status) && (
              <Field
                label="Next follow-up"
                hint={
                  `Follow-ups sent: ${lead.follow_up_count} of ${MAX_FOLLOW_UPS}. ` +
                  (lead.follow_up_count >= MAX_FOLLOW_UPS
                    ? "That is the maximum; no more reminders unless you set a date."
                    : `Set automatically ${FOLLOW_UP_AFTER_DAYS} days after each contact.`)
                }
              >
                <Input type="date" value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} />
              </Field>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="submit" variant="primary" disabled={busy}>
                Save
              </Button>
              {status !== "do_not_contact" && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    patch({ markContacted: true }, lead.first_contacted_at ? "Marked as followed up today." : "Marked as contacted today.")
                  }
                >
                  <IconCheck />
                  {lead.first_contacted_at ? "Mark followed up today" : "Mark contacted today"}
                </Button>
              )}
              {message && <InlineMessage tone={message.kind === "error" ? "danger" : "success"}>{message.text}</InlineMessage>}
            </div>
          </form>
        </Section>

        <div className="border-t border-border pt-5">
          <WebsiteCheck lead={lead} onChecked={applyLead} />
        </div>

        <div className="border-t border-border pt-5">
          {canDraftOutreach(status) ? (
            <OutreachDraft
              phones={place?.phones ?? []}
              emails={place?.emails ?? []}
              category={categoryGroupOf(place?.basic_category ?? null)}
              name={label.trim() || place?.name || null}
              confirmedSentences={confirmedSentences}
              defaultKind={lead.first_contacted_at ? "follow_up" : "first"}
            />
          ) : (
            <p className="text-sm text-muted">No outreach drafts for leads marked “{LEAD_STATUS_LABELS[status]}”.</p>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <Button variant="danger" size="sm" disabled={busy} onClick={remove}>
            <IconTrash />
            Delete lead
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
