"use client";

import { useState } from "react";
import { DEFAULT_OUTREACH_MESSAGE, whatsappHref } from "@/lib/leads/outreach";

/** Editable, copyable draft. Nothing is ever sent automatically. */
export function OutreachDraft({ phones }: { phones: string[] }) {
  const [text, setText] = useState(DEFAULT_OUTREACH_MESSAGE);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  const whatsappLinks = phones
    .map((phone) => ({ phone, href: whatsappHref(phone, text) }))
    .filter((link): link is { phone: string; href: string } => link.href !== null);

  return (
    <section aria-labelledby="draft-heading">
      <h3 id="draft-heading" className="font-semibold">
        Outreach draft
      </h3>
      <p className="mt-1 text-xs text-neutral-600">
        Edit before sending. The default text says you found them on Google Maps, so change that line if you didn’t.
        Only mention website issues you have actually checked. Contact one business at a time, and stop if they ask.
      </p>
      <label className="sr-only" htmlFor="outreach-text">
        Message
      </label>
      <textarea
        id="outreach-text"
        dir="auto"
        className="mt-2 min-h-56 w-full rounded-md border border-neutral-300 px-2 py-1.5"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCopied("idle");
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="rounded-md border border-neutral-300 px-3 py-1.5">
          Copy message
        </button>
        {whatsappLinks.map(({ phone, href }) => (
          <a
            key={phone}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-green-600 px-3 py-1.5 text-green-800"
          >
            Open in WhatsApp ({phone})<span className="sr-only"> (opens in a new tab; you still press send)</span>
          </a>
        ))}
        <span role="status" className="text-xs">
          {copied === "copied" && "Copied."}
          {copied === "failed" && "Copy failed. Select the text and copy it manually."}
        </span>
      </div>
      {whatsappLinks.length > 0 && (
        <p className="mt-1 text-xs text-neutral-600">WhatsApp opens with the message filled in. You review it and press send yourself.</p>
      )}
    </section>
  );
}
