"use client";

import { useState, type ReactNode } from "react";
import { Section } from "@/components/ui";
import { fullDateTime, relativeDay } from "@/lib/leads/activity";
import { MAX_FOLLOW_UPS } from "@/lib/leads/followUps";
import { LEAD_STATUS_LABELS } from "@/lib/leads/leads";
import type { Lead } from "@/lib/server/leadsStore";

function When({ timestamp, now }: { timestamp: string; now: Date }) {
  return (
    <time dateTime={timestamp} title={fullDateTime(timestamp)}>
      {relativeDay(timestamp, now)}
    </time>
  );
}

/** Read-only contact history; the footer's actions change it. */
export function LeadActivity({ lead }: { lead: Lead }) {
  const [now] = useState(() => new Date());
  const items: { label: string; value: ReactNode }[] = [
    { label: "Saved", value: <When timestamp={lead.created_at} now={now} /> },
    {
      label: `${LEAD_STATUS_LABELS[lead.lead_status]} since`,
      value: <When timestamp={lead.status_changed_at} now={now} />,
    },
    {
      label: "First contacted",
      value: lead.first_contacted_at ? <When timestamp={lead.first_contacted_at} now={now} /> : <span className="text-muted">Not yet</span>,
    },
  ];
  if (lead.first_contacted_at) {
    // Only when it adds something: a later day than the first contact.
    if (lead.last_contacted_at && relativeDay(lead.last_contacted_at, now) !== relativeDay(lead.first_contacted_at, now)) {
      items.push({ label: "Last contacted", value: <When timestamp={lead.last_contacted_at} now={now} /> });
    }
    items.push({ label: "Follow-ups sent", value: `${Math.min(lead.follow_up_count, MAX_FOLLOW_UPS)} of ${MAX_FOLLOW_UPS}` });
  }
  if (lead.closed_at && (lead.lead_status === "won" || lead.lead_status === "lost")) {
    items.push({
      label: lead.lead_status === "won" ? "Won on" : "Lost on",
      value: <When timestamp={lead.closed_at} now={now} />,
    });
  }

  return (
    <Section title="Activity">
      <dl className="grid grid-cols-3 gap-x-3 gap-y-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-xs text-muted">{item.label}</dt>
            <dd className="mt-0.5 text-sm font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
