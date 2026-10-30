"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Field,
  InlineMessage,
  Input,
  PageHeader,
  Section,
  SegmentedControl,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import {
  buildDraft,
  DEFAULT_TEMPLATES,
  emailSubject,
  MAX_PARAGRAPH_LENGTH,
  MAX_SUBJECT_LENGTH,
  OUTREACH_LANGUAGES,
  type DraftKind,
  type LanguageTemplates,
  type OutreachLanguage,
  type OutreachTemplates,
} from "@/lib/leads/outreach";
import { CATEGORY_GROUPS, isCategoryGroup, type CategoryGroup } from "@/lib/places/categories";
import { setCachedTemplates } from "../leads/useOutreachTemplates";

type LoadState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

const LANGUAGE_OPTIONS = (Object.keys(OUTREACH_LANGUAGES) as OutreachLanguage[]).map((key) => ({
  value: key,
  label: OUTREACH_LANGUAGES[key].label,
}));
const SAMPLE_NAME: Record<OutreachLanguage, string> = { en: "Example Cafe", ar: "مقهى المثال" };

async function request(method: "GET" | "PUT" | "DELETE", body?: unknown) {
  const response = await fetch("/api/templates", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message ?? "Templates are unavailable.");
  return result as { templates: OutreachTemplates; customized: boolean };
}

export function TemplatesEditor() {
  const [templates, setTemplates] = useState<OutreachTemplates>(DEFAULT_TEMPLATES);
  const [customized, setCustomized] = useState(false);
  const [language, setLanguage] = useState<OutreachLanguage>("en");
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [previewKind, setPreviewKind] = useState<DraftKind>("first");
  const [previewCategory, setPreviewCategory] = useState<CategoryGroup | "">("food");

  useEffect(() => {
    request("GET")
      .then((result) => {
        setTemplates(result.templates);
        setCustomized(result.customized);
        setLoad({ kind: "ready" });
      })
      .catch((error: unknown) => setLoad({ kind: "error", message: error instanceof Error ? error.message : "Templates are unavailable." }));
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const t = templates[language];
  const dir = OUTREACH_LANGUAGES[language].dir;

  function update(change: (current: LanguageTemplates) => LanguageTemplates) {
    setTemplates((all) => ({ ...all, [language]: change(all[language]) }));
    setDirty(true);
    setMessage(null);
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await request("PUT", { templates });
      setCachedTemplates(result.templates);
      setCustomized(true);
      setDirty(false);
      setMessage({ kind: "ok", text: "Saved. New drafts use these templates." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm("Reset all templates (both languages) to the defaults? Your edits will be lost.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await request("DELETE");
      setTemplates(result.templates);
      setCachedTemplates(result.templates);
      setCustomized(false);
      setDirty(false);
      setMessage({ kind: "ok", text: "Back to the default templates." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not reset." });
    } finally {
      setBusy(false);
    }
  }

  const preview = useMemo(
    () =>
      buildDraft({
        language,
        name: SAMPLE_NAME[language],
        sentences: [],
        kind: previewKind,
        category: previewCategory || null,
        templates,
      }),
    [language, previewKind, previewCategory, templates],
  );

  const paragraph = (label: string, value: string, onChange: (value: string) => void, hint?: string) => (
    <Field label={label} hint={hint}>
      <Textarea
        dir={dir}
        lang={language}
        className="min-h-16 field-sizing-content"
        maxLength={MAX_PARAGRAPH_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Message templates"
        description="The text behind every outreach draft. Each box is one paragraph. Drafts stay editable per business."
        actions={
          <>
            <Button onClick={reset} disabled={busy || load.kind !== "ready" || (!customized && !dirty)}>
              Reset to defaults
            </Button>
            <Button variant="primary" onClick={save} disabled={busy || !dirty}>
              Save templates
            </Button>
          </>
        }
      />

      <div aria-live="polite" className="mt-4">
        {load.kind === "loading" && <Spinner label="Loading templates…" />}
        {load.kind === "error" && <Alert tone="danger">{load.message}</Alert>}
        {message && <InlineMessage tone={message.kind === "error" ? "danger" : "success"}>{message.text}</InlineMessage>}
      </div>

      {load.kind === "ready" && (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <SegmentedControl label="Template language" options={LANGUAGE_OPTIONS} value={language} onChange={setLanguage} />

            <Card className="p-5">
              <Section title="First message" description="Paragraphs in order. Your portfolio line and any website findings you confirmed are added automatically.">
                <div className="space-y-3">
                  {paragraph("Greeting (name unknown)", t.first.greeting, (v) => update((c) => ({ ...c, first: { ...c.first, greeting: v } })))}
                  {paragraph(
                    "Greeting with the business name",
                    t.first.greetingNamed,
                    (v) => update((c) => ({ ...c, first: { ...c.first, greetingNamed: v } })),
                    "Must contain {name}, which becomes the business name.",
                  )}
                  {paragraph("About you", t.first.intro, (v) => update((c) => ({ ...c, first: { ...c.first, intro: v } })))}
                  {paragraph(
                    "General question",
                    t.first.question,
                    (v) => update((c) => ({ ...c, first: { ...c.first, question: v } })),
                    "Used when the business's category has no pitch below.",
                  )}
                  {paragraph("Closing", t.first.closing, (v) => update((c) => ({ ...c, first: { ...c.first, closing: v } })))}
                </div>
              </Section>
            </Card>

            <Card className="p-5">
              <Section
                title="Category pitches"
                description="In first messages, the pitch replaces the general question for businesses in that category. Describe what you offer, not what they lack. Leave a box empty to use the general question."
              >
                <div className="space-y-3">
                  {(Object.keys(CATEGORY_GROUPS) as CategoryGroup[]).map((group) => (
                    <div key={group}>
                      {paragraph(CATEGORY_GROUPS[group].label, t.pitches[group], (v) =>
                        update((c) => ({ ...c, pitches: { ...c.pitches, [group]: v } })),
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            </Card>

            <Card className="p-5">
              <Section title="Follow-up" description="Sent at most twice, 4 days apart, only if they haven't replied.">
                <div className="space-y-3">
                  {paragraph("Greeting (name unknown)", t.followUp.greeting, (v) => update((c) => ({ ...c, followUp: { ...c.followUp, greeting: v } })))}
                  {paragraph(
                    "Greeting with the business name",
                    t.followUp.greetingNamed,
                    (v) => update((c) => ({ ...c, followUp: { ...c.followUp, greetingNamed: v } })),
                    "Must contain {name}.",
                  )}
                  {paragraph("Body", t.followUp.body, (v) => update((c) => ({ ...c, followUp: { ...c.followUp, body: v } })))}
                  {paragraph(
                    "Closing",
                    t.followUp.closing,
                    (v) => update((c) => ({ ...c, followUp: { ...c.followUp, closing: v } })),
                    "Keep an easy way to say no.",
                  )}
                </div>
              </Section>
            </Card>

            <Card className="p-5">
              <Section title="Email subjects">
                <div className="space-y-3">
                  {(["first", "followUp"] as const).map((key) => (
                    <Field key={key} label={key === "first" ? "First message" : "Follow-up"}>
                      <Input
                        dir={dir}
                        maxLength={MAX_SUBJECT_LENGTH}
                        value={t.subjects[key]}
                        onChange={(e) => update((c) => ({ ...c, subjects: { ...c.subjects, [key]: e.target.value } }))}
                      />
                    </Field>
                  ))}
                </div>
              </Section>
            </Card>
          </div>

          <div>
            <Card className="p-5 lg:sticky lg:top-16">
              <Section title="Preview" description={`For a sample business, “${SAMPLE_NAME[language]}”.`}>
                <div className="flex flex-wrap items-end gap-2">
                  <SegmentedControl
                    label="Preview type"
                    size="sm"
                    value={previewKind}
                    onChange={setPreviewKind}
                    options={[
                      { value: "first", label: "First message" },
                      { value: "follow_up", label: "Follow-up" },
                    ]}
                  />
                  {previewKind === "first" && (
                    <Select
                      aria-label="Preview category"
                      className="w-auto"
                      value={previewCategory}
                      onChange={(e) => setPreviewCategory(isCategoryGroup(e.target.value) ? e.target.value : "")}
                    >
                      <option value="">No category (general question)</option>
                      {(Object.keys(CATEGORY_GROUPS) as CategoryGroup[]).map((group) => (
                        <option key={group} value={group}>
                          {CATEGORY_GROUPS[group].label}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted">
                  Subject: <span dir={dir}>{emailSubject(templates, previewKind, language)}</span>
                </p>
                <div
                  dir={dir}
                  lang={language}
                  className="mt-2 rounded-lg border border-border bg-surface-muted p-4 text-sm leading-relaxed whitespace-pre-wrap"
                >
                  {preview}
                </div>
                {dirty && <p className="mt-2 text-xs text-warning">Unsaved changes.</p>}
              </Section>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
