"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  ExternalButtonLink,
  IconCopy,
  IconMail,
  IconMessage,
  IconRefresh,
  InlineMessage,
  Section,
  SegmentedControl,
  Textarea,
  buttonClasses,
} from "@/components/ui";
import { mailtoHref } from "@/lib/places/emails";
import { CATEGORY_GROUPS, type CategoryGroup } from "@/lib/places/categories";
import {
  buildDraft,
  defaultLanguage,
  emailSubject,
  namePart,
  OUTREACH_LANGUAGES,
  whatsappHref,
  type DraftKind,
  type OutreachLanguage,
  type PortfolioMode,
} from "@/lib/leads/outreach";
import { safeHref } from "@/lib/places/links";
import { useOutreachTemplates } from "./useOutreachTemplates";

// From PORTFOLIO_URL in .env.local (see next.config.ts). Empty when not set.
// A bare trailing "/" would jump to the wrong side in right-to-left text.
const PORTFOLIO_URL = safeHref(process.env.PORTFOLIO_URL ?? "")?.replace(/^(https?:\/\/[^/?#]+)\/$/, "$1") ?? null;

const LANGUAGE_OPTIONS = (Object.keys(OUTREACH_LANGUAGES) as OutreachLanguage[]).map((key) => ({
  value: key,
  label: OUTREACH_LANGUAGES[key].label,
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
  emails = [],
  name,
  confirmedSentences,
  defaultKind = "first",
  category = null,
  onSendOpened,
}: {
  phones: string[];
  emails?: string[];
  name: string | null;
  confirmedSentences: { en: string; ar: string }[];
  defaultKind?: DraftKind;
  /** The business's category group: first messages use its pitch. */
  category?: CategoryGroup | null;
  /** Called when the operator opens WhatsApp or their mail app with the draft. */
  onSendOpened?: (channel: "whatsapp" | "email") => void;
}) {
  const templates = useOutreachTemplates();
  const [language, setLanguage] = useState<OutreachLanguage>(() => defaultLanguage(name));
  const [kind, setKind] = useState<DraftKind>(defaultKind);
  // null = automatic: link in follow-ups; in a first message only an offer to share examples.
  const [linkChoice, setLinkChoice] = useState<boolean | null>(null);
  const includeLink = linkChoice ?? kind === "follow_up";
  const portfolioMode: PortfolioMode = !PORTFOLIO_URL ? "none" : includeLink ? "link" : kind === "first" ? "offer" : "none";
  const generated = useMemo(
    () =>
      buildDraft({
        language,
        name: namePart(name, language),
        sentences: confirmedSentences.map((s) => s[language]),
        kind,
        portfolio: { mode: portfolioMode, url: PORTFOLIO_URL },
        category,
        templates,
      }),
    [language, name, confirmedSentences, kind, portfolioMode, category, templates],
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
    setLinkChoice(null);
    setCopied("idle");
  }

  function toggleLink(next: boolean) {
    if (edited && !window.confirm("Change the portfolio line? Your edits to this draft will be replaced.")) return;
    setEdited(false);
    setLinkChoice(next);
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

  const emailLinks = emails
    .map((email) => ({ email, href: mailtoHref(email, { subject: emailSubject(templates, kind, language), body: text }) }))
    .filter((link): link is { email: string; href: string } => link.href !== null);

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
          {kind === "first" && category && templates[language].pitches[category]?.trim()
            ? `, with the ${CATEGORY_GROUPS[category].label.toLowerCase()} pitch`
            : ""}
          . You send it yourself, one business at a time.
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl label="Draft type" size="sm" options={KIND_OPTIONS} value={kind} onChange={switchKind} />
        <SegmentedControl label="Draft language" size="sm" options={LANGUAGE_OPTIONS} value={language} onChange={switchLanguage} />
      </div>
      {PORTFOLIO_URL && (
        <div className="mt-2">
          <Checkbox
            label="Include portfolio link"
            checked={includeLink}
            onChange={(e) => toggleLink(e.target.checked)}
          />
          <p className="mt-0.5 pl-6 text-xs text-muted">
            {includeLink
              ? "Good for emails and follow-ups."
              : kind === "first"
                ? "First WhatsApp to a stranger: the draft offers examples instead of a link (links from unknown numbers look like spam). Tick it for an email."
                : "No portfolio line in this follow-up."}
          </p>
        </div>
      )}
      <label className="sr-only" htmlFor="outreach-text">
        Message
      </label>
      <Textarea
        id="outreach-text"
        dir={OUTREACH_LANGUAGES[language].dir}
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
          <ExternalButtonLink key={phone} href={href} variant="success" onClick={() => onSendOpened?.("whatsapp")}>
            <IconMessage />
            WhatsApp <span dir="ltr">{phone}</span>
          </ExternalButtonLink>
        ))}
        {emailLinks.map(({ email, href }) => (
          <a key={email} href={href} className={buttonClasses({ variant: "secondary" })} title={email} onClick={() => onSendOpened?.("email")}>
            <IconMail />
            Email <span dir="ltr" className="max-w-40 truncate">{email}</span>
          </a>
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
      {emailLinks.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Email opens your own mail app with this message filled in, for this one business. Many listed emails are the
          owner&apos;s personal inbox: keep it short, relevant, and stop if they ask.
        </p>
      )}
      {whatsappLinks.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          WhatsApp opens with the message filled in; you review it and press send. If emojis show as “?”, use Copy and paste instead.
        </p>
      )}
    </Section>
  );
}
