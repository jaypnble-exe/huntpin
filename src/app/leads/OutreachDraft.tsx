"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  ExternalButtonLink,
  IconCopy,
  IconMessage,
  IconRefresh,
  InlineMessage,
  Section,
  SegmentedControl,
  Textarea,
} from "@/components/ui";
import {
  buildDraft,
  defaultLanguage,
  namePart,
  OUTREACH_TEMPLATES,
  whatsappHref,
  type DraftKind,
  type OutreachLanguage,
} from "@/lib/leads/outreach";

const LANGUAGE_OPTIONS = (Object.keys(OUTREACH_TEMPLATES) as OutreachLanguage[]).map((key) => ({
  value: key,
  label: OUTREACH_TEMPLATES[key].label,
}));
const KIND_OPTIONS: { value: DraftKind; label: string }[] = [
  { value: "first", label: "First message" },
  { value: "follow_up", label: "Follow-up" },
];

/**
 * Personalised, editable, copyable draft. Nothing is ever sent automatically.
 * Until the operator edits it, the draft follows the name and confirmed
 * observations; after that, "Rebuild draft" regenerates it on request.
 */
export function OutreachDraft({
  phones,
  name,
  confirmedSentences,
  defaultKind = "first",
}: {
  phones: string[];
  name: string | null;
  confirmedSentences: { en: string; ar: string }[];
  defaultKind?: DraftKind;
}) {
  const [language, setLanguage] = useState<OutreachLanguage>(() => defaultLanguage(name));
  const [kind, setKind] = useState<DraftKind>(defaultKind);
  const generated = useMemo(
    () =>
      buildDraft({
        language,
        name: namePart(name, language),
        sentences: confirmedSentences.map((s) => s[language]),
        kind,
      }),
    [language, name, confirmedSentences, kind],
  );
  const [text, setText] = useState(generated);
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  // Follow the generated draft until the operator edits it.
  useEffect(() => {
    if (!edited) setText(generated);
  }, [generated, edited]);

  function switchLanguage(next: OutreachLanguage) {
    if (edited && !window.confirm("Switch language? Your edits to this draft will be replaced.")) return;
    setEdited(false);
    setLanguage(next);
    setCopied("idle");
  }

  function switchKind(next: DraftKind) {
    if (edited && !window.confirm("Switch draft type? Your edits to this draft will be replaced.")) return;
    setEdited(false);
    setKind(next);
    setCopied("idle");
  }

  function rebuild() {
    if (!window.confirm("Rebuild the draft? Your edits will be replaced.")) return;
    setEdited(false);
    setText(generated);
  }

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
    <Section
      title="Outreach draft"
      description={
        <>
          Personalised with the business name
          {confirmedSentences.length > 0
            ? ` and ${confirmedSentences.length} finding${confirmedSentences.length === 1 ? "" : "s"} you confirmed`
            : ""}
          . You send it yourself, one business at a time.
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl label="Draft type" size="sm" options={KIND_OPTIONS} value={kind} onChange={switchKind} />
        <SegmentedControl label="Draft language" size="sm" options={LANGUAGE_OPTIONS} value={language} onChange={switchLanguage} />
      </div>
      <label className="sr-only" htmlFor="outreach-text">
        Message
      </label>
      <Textarea
        id="outreach-text"
        dir={OUTREACH_TEMPLATES[language].dir}
        lang={language}
        className="mt-3 min-h-60"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setEdited(true);
          setCopied("idle");
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {whatsappLinks.map(({ phone, href }) => (
          <ExternalButtonLink key={phone} href={href} variant="success">
            <IconMessage />
            WhatsApp <span dir="ltr">{phone}</span>
          </ExternalButtonLink>
        ))}
        <Button onClick={copy}>
          <IconCopy />
          {copied === "copied" ? "Copied" : "Copy"}
        </Button>
        {edited && text !== generated && (
          <Button variant="ghost" onClick={rebuild}>
            <IconRefresh />
            Rebuild draft
          </Button>
        )}
        {copied === "failed" && <InlineMessage tone="danger">Copy failed. Select the text and copy it manually.</InlineMessage>}
      </div>
      {whatsappLinks.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          WhatsApp opens with the message filled in; you review it and press send. If emojis show as “?”, use Copy and paste instead.
        </p>
      )}
    </Section>
  );
}
