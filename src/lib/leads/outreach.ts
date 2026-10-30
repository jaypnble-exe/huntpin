// Outreach drafts. Drafts only: nothing here sends a message. The operator
// edits, copies, and sends each one manually.
import { CATEGORY_GROUPS, type CategoryGroup } from "../places/categories";

export const OUTREACH_LANGUAGES = {
  en: { label: "English", dir: "ltr" },
  ar: { label: "العربية", dir: "rtl" },
} as const;

export type OutreachLanguage = keyof typeof OUTREACH_LANGUAGES;
export type DraftKind = "first" | "follow_up";

/**
 * Message templates, one paragraph per field. The operator can edit them on
 * the Templates page (stored in app_settings); these are the defaults.
 * `{name}` in a named greeting is replaced by the business name.
 */
export interface LanguageTemplates {
  first: { greeting: string; greetingNamed: string; intro: string; question: string; closing: string };
  followUp: { greeting: string; greetingNamed: string; body: string; closing: string };
  /** Replaces the first message's general question for businesses in that category group. */
  pitches: Record<CategoryGroup, string>;
  subjects: { first: string; followUp: string };
}

export type OutreachTemplates = Record<OutreachLanguage, LanguageTemplates>;

// Default messages (see CLAUDE.md). Do not add business-specific claims here;
// only mention a website issue if it was actually checked. Pitches describe
// what is offered to a kind of business, never what a business lacks.
export const DEFAULT_TEMPLATES: OutreachTemplates = {
  en: {
    first: {
      greeting: "Hi! 👋 I came across your business online and wanted to reach out.",
      greetingNamed: "Hi {name} team! 👋 I came across your business online and wanted to reach out.",
      intro:
        "I’m a web and mobile app developer, and I help businesses build and improve websites, develop custom systems and mobile applications, and implement AI automations to streamline their operations.",
      question:
        "I was wondering if you have any digital projects, website improvements, or automation ideas that you’d like to explore. I’d be happy to discuss how I could help!",
      closing: "Would you be open to a quick chat? 😊",
    },
    followUp: {
      greeting: "Hi! 👋 Just following up on my earlier message.",
      greetingNamed: "Hi {name} team! 👋 Just following up on my earlier message.",
      body: "I’d be glad to help with your website, a custom system, a mobile app, or automating part of your work.",
      closing: "Would a quick chat this week suit you? If now isn’t a good time, no problem at all, just let me know. 😊",
    },
    pitches: {
      food: "For restaurants and cafés, I build things like digital QR menus, online ordering and table bookings, so customers can order from you directly, not only through delivery apps.",
      retail: "For shops, I build online stores and product catalogues with WhatsApp ordering, so customers can browse and order from you any time.",
      beauty: "For salons, spas and gyms, I build websites with online booking and reminders, so clients can book without calling or messaging.",
      health: "For clinics, I build websites with online appointment booking, doctor profiles and patient reminders, which make it easier for new patients to find and choose you.",
      services: "For service businesses, I build websites that show your work and let customers request a quote online, plus simple systems to manage bookings and clients.",
      auto: "For automotive businesses, I build websites with service booking and price requests, and simple systems to track jobs and customers.",
      hotels: "For hotels and stays, I build websites with direct booking, so guests can reserve with you without booking-site commissions.",
      education: "For schools and training centres, I build websites with online registration, course pages and portals for parents or students.",
    },
    subjects: { first: "Website & app development: a quick introduction", followUp: "Following up on my earlier message" },
  },
  ar: {
    first: {
      greeting: "مرحباً! 👋 صادفت نشاطكم التجاري على الإنترنت وأحببت التواصل معكم.",
      greetingNamed: "مرحباً فريق {name}! 👋 صادفت نشاطكم التجاري على الإنترنت وأحببت التواصل معكم.",
      intro:
        "أنا مطوّر مواقع وتطبيقات جوال، وأساعد الأنشطة التجارية في إنشاء المواقع الإلكترونية وتطويرها، وبناء أنظمة مخصصة وتطبيقات جوال، وتطبيق حلول الأتمتة بالذكاء الاصطناعي لتسهيل أعمالهم.",
      question:
        "هل لديكم أي مشاريع رقمية، أو تحسينات على موقعكم، أو أفكار للأتمتة ترغبون في استكشافها؟ يسعدني أن نناقش كيف يمكنني المساعدة!",
      closing: "هل يناسبكم أن نتحدث قليلاً؟ 😊",
    },
    followUp: {
      greeting: "مرحباً! 👋 أتابع معكم بخصوص رسالتي السابقة.",
      greetingNamed: "مرحباً فريق {name}! 👋 أتابع معكم بخصوص رسالتي السابقة.",
      body: "يسعدني مساعدتكم في موقعكم الإلكتروني، أو نظام مخصص، أو تطبيق جوال، أو أتمتة جزء من أعمالكم.",
      closing: "هل يناسبكم أن نتحدث قليلاً هذا الأسبوع؟ وإذا لم يكن الوقت مناسباً فلا بأس أبداً، فقط أخبروني. 😊",
    },
    pitches: {
      food: "للمطاعم والمقاهي، أبني حلولاً مثل المنيو الرقمي برمز QR، والطلب أونلاين، وحجز الطاولات، ليطلب العملاء منكم مباشرة وليس فقط عبر تطبيقات التوصيل.",
      retail: "للمتاجر، أبني متاجر إلكترونية وكتالوجات منتجات مع الطلب عبر واتساب، ليتصفح العملاء منتجاتكم ويطلبوا منكم في أي وقت.",
      beauty: "للصالونات ومراكز التجميل والنوادي الرياضية، أبني مواقع مع حجز المواعيد أونلاين والتذكيرات، ليحجز العملاء دون الحاجة للاتصال أو المراسلة.",
      health: "للعيادات، أبني مواقع مع حجز المواعيد أونلاين، وصفحات تعريفية للأطباء، وتذكيرات للمرضى، مما يسهّل على المرضى الجدد إيجادكم واختياركم.",
      services: "لأنشطة الخدمات، أبني مواقع تعرض أعمالكم وتتيح للعملاء طلب عرض سعر أونلاين، إضافة إلى أنظمة بسيطة لإدارة الحجوزات والعملاء.",
      auto: "لأنشطة السيارات، أبني مواقع مع حجز مواعيد الصيانة وطلب الأسعار، وأنظمة بسيطة لمتابعة الطلبات والعملاء.",
      hotels: "للفنادق وأماكن الإقامة، أبني مواقع مع الحجز المباشر، ليحجز الضيوف معكم دون عمولات مواقع الحجز.",
      education: "للمدارس ومراكز التدريب، أبني مواقع مع التسجيل أونلاين، وصفحات للدورات، وبوابات لأولياء الأمور والطلاب.",
    },
    subjects: { first: "تطوير المواقع والتطبيقات: تعريف سريع", followUp: "متابعة لرسالتي السابقة" },
  },
};

const LANGS = Object.keys(OUTREACH_LANGUAGES) as OutreachLanguage[];

function firstText(t: LanguageTemplates): string {
  return [t.first.greeting, t.first.intro, t.first.question, t.first.closing].join("\n\n");
}

/** The general default messages, as full text (kept for display and tests). */
export const OUTREACH_TEMPLATES = Object.fromEntries(
  LANGS.map((lang) => [lang, { ...OUTREACH_LANGUAGES[lang], text: firstText(DEFAULT_TEMPLATES[lang]) }]),
) as Record<OutreachLanguage, { label: string; dir: "ltr" | "rtl"; text: string }>;

export const FOLLOW_UP_TEMPLATES = Object.fromEntries(
  LANGS.map((lang) => {
    const f = DEFAULT_TEMPLATES[lang].followUp;
    return [lang, [f.greeting, f.body, f.closing].join("\n\n")];
  }),
) as Record<OutreachLanguage, string>;

export const DEFAULT_OUTREACH_MESSAGE = OUTREACH_TEMPLATES.en.text;

export function emailSubject(templates: OutreachTemplates, kind: DraftKind, language: OutreachLanguage): string {
  return templates[language].subjects[kind === "first" ? "first" : "followUp"];
}

// ---------------------------------------------------------------------------
// Validation for edited templates (server) and merging over defaults.

export const MAX_PARAGRAPH_LENGTH = 1000;
export const MAX_SUBJECT_LENGTH = 150;
const CONTROL_CHARS = /[\u0000-\u0009\u000b-\u001f\u007f]/;

type Shape = { [key: string]: number | Shape };
const PARAGRAPH = MAX_PARAGRAPH_LENGTH;
const LANGUAGE_SHAPE: Shape = {
  first: { greeting: PARAGRAPH, greetingNamed: PARAGRAPH, intro: PARAGRAPH, question: PARAGRAPH, closing: PARAGRAPH },
  followUp: { greeting: PARAGRAPH, greetingNamed: PARAGRAPH, body: PARAGRAPH, closing: PARAGRAPH },
  pitches: Object.fromEntries(Object.keys(CATEGORY_GROUPS).map((key) => [key, PARAGRAPH])),
  subjects: { first: MAX_SUBJECT_LENGTH, followUp: MAX_SUBJECT_LENGTH },
};

function check(value: unknown, shape: Shape, path: string): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return `${path} must be an object`;
  const record = value as Record<string, unknown>;
  const extra = Object.keys(record).find((key) => !(key in shape));
  if (extra) return `${path}.${extra} is not a template field`;
  for (const [key, rule] of Object.entries(shape)) {
    const field = record[key];
    if (typeof rule === "number") {
      if (typeof field !== "string") return `${path}.${key} must be text`;
      if (field.length > rule) return `${path}.${key} must be at most ${rule} characters`;
      if (CONTROL_CHARS.test(field)) return `${path}.${key} contains invalid characters`;
    } else {
      const error = check(field, rule, `${path}.${key}`);
      if (error) return error;
    }
  }
  return null;
}

/** Validates a full set of edited templates. Unknown fields are rejected. */
export function parseTemplates(body: unknown): { ok: true; templates: OutreachTemplates } | { ok: false; error: string } {
  const error = check(body, Object.fromEntries(LANGS.map((lang) => [lang, LANGUAGE_SHAPE])), "templates");
  if (error) return { ok: false, error };
  const templates = body as OutreachTemplates;
  for (const lang of LANGS) {
    for (const kind of ["first", "followUp"] as const) {
      if (!templates[lang][kind].greetingNamed.includes("{name}")) {
        return { ok: false, error: `templates.${lang}.${kind}.greetingNamed must contain {name}` };
      }
      if (!templates[lang][kind].closing.trim()) return { ok: false, error: `templates.${lang}.${kind}.closing must not be empty` };
    }
  }
  return { ok: true, templates };
}

/**
 * Stored templates over the defaults, field by field, so fields added in a
 * later version (or damaged ones) fall back to the default text.
 */
export function mergeTemplates(stored: unknown): OutreachTemplates {
  const pick = (value: unknown, fallback: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(fallback).map(([key, def]) => {
        const v = typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
        if (typeof def === "string") return [key, typeof v === "string" && !CONTROL_CHARS.test(v) ? v : def];
        return [key, pick(v, def as Record<string, unknown>)];
      }),
    );
  const merged = pick(stored, DEFAULT_TEMPLATES as unknown as Record<string, unknown>) as unknown as OutreachTemplates;
  // A named greeting without {name} would drop the name silently.
  for (const lang of LANGS) {
    for (const kind of ["first", "followUp"] as const) {
      if (!merged[lang][kind].greetingNamed.includes("{name}")) merged[lang][kind].greetingNamed = DEFAULT_TEMPLATES[lang][kind].greetingNamed;
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------

const ARABIC_RUN = /[؀-ۿ][؀-ۿ\s]*[؀-ۿ]|[؀-ۿ]/g;
const LATIN_RUN = /[A-Za-z0-9][A-Za-z0-9&'’.\- ]*[A-Za-z0-9]|[A-Za-z]/g;

function cleanName(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * The part of a (possibly bilingual) business name that suits the draft
 * language, e.g. "Basic Cafe" or "بيسك كافيه" from "Basic Cafe بيسك كافيه".
 */
export function namePart(label: string | null, language: OutreachLanguage): string | null {
  if (!label?.trim()) return null;
  const runs = label.match(language === "ar" ? ARABIC_RUN : LATIN_RUN) ?? [];
  const longest = runs.map(cleanName).sort((a, b) => b.length - a.length)[0];
  return longest && longest.length >= 2 ? longest : cleanName(label);
}

/** Arabic for Arabic-only names, English otherwise. The operator can switch. */
export function defaultLanguage(label: string | null): OutreachLanguage {
  if (!label) return "en";
  return /[؀-ۿ]/.test(label) && !/[A-Za-z]/.test(label) ? "ar" : "en";
}

const OBSERVATION_CLOSE: Record<OutreachLanguage, string> = {
  en: "I’d be happy to help with that.",
  ar: "ويسعدني المساعدة في ذلك.",
};

/**
 * How the portfolio appears: "link" adds the URL (emails, follow-ups),
 * "offer" offers examples without a link (first WhatsApp to a stranger),
 * "none" leaves it out.
 */
export type PortfolioMode = "link" | "offer" | "none";

const PORTFOLIO_LINES: Record<"link" | "offer", Record<OutreachLanguage, (url: string) => string>> = {
  link: {
    // URL on its own line: no right-to-left reordering in Arabic, easier to tap.
    en: (url) => `You can see some of my work here:\n${url}`,
    ar: (url) => `يمكنكم الاطلاع على بعض أعمالي هنا:\n${url}`,
  },
  offer: {
    en: () => "If it helps, I’d be happy to share a few examples of my work.",
    ar: () => "وإذا كان ذلك مفيداً، يسعدني مشاركة بعض نماذج أعمالي.",
  },
};

/**
 * Personalised draft: the business name in the greeting, a pitch for the
 * business's category in first messages, and only the observations the
 * operator confirmed by looking at the site.
 */
export function buildDraft({
  language,
  name,
  sentences,
  kind = "first",
  portfolio,
  category = null,
  templates = DEFAULT_TEMPLATES,
}: {
  language: OutreachLanguage;
  name: string | null;
  sentences: string[];
  kind?: DraftKind;
  portfolio?: { mode: PortfolioMode; url: string | null };
  category?: CategoryGroup | null;
  templates?: OutreachTemplates;
}): string {
  const t = templates[language];
  const message = kind === "first" ? t.first : t.followUp;
  const greeting = name ? message.greetingNamed.split("{name}").join(name) : message.greeting;
  const pitch = category ? t.pitches[category]?.trim() : "";
  const paragraphs =
    kind === "first"
      ? [greeting, t.first.intro, pitch || t.first.question, t.first.closing]
      : [greeting, t.followUp.body, t.followUp.closing];
  // First message: after the intro. Follow-up: right after the greeting.
  if (sentences.length > 0) {
    paragraphs.splice(kind === "first" ? 2 : 1, 0, `${sentences.join(" ")} ${OBSERVATION_CLOSE[language]}`);
  }
  // Portfolio goes just before the closing question.
  if (portfolio && portfolio.mode !== "none" && (portfolio.mode === "offer" || portfolio.url)) {
    paragraphs.splice(paragraphs.length - 1, 0, PORTFOLIO_LINES[portfolio.mode][language](portfolio.url ?? ""));
  }
  // A paragraph the operator emptied on the Templates page is left out.
  return paragraphs.map((p) => p.trim()).filter(Boolean).join("\n\n");
}

/**
 * Opens WhatsApp with the draft pre-filled for one recipient. The operator
 * still reviews and presses send; nothing is sent automatically.
 */
export function whatsappHref(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  // api.whatsapp.com keeps emojis in prefilled text; wa.me links can turn them into "?".
  const params = new URLSearchParams({ phone: digits, text: message });
  return `https://api.whatsapp.com/send?${params.toString().replace(/\+/g, "%20")}`;
}
