// Outreach drafts. Drafts only: nothing here sends a message. The operator
// edits, copies, and sends each one manually.

// Default messages (see CLAUDE.md). Do not add business-specific claims here;
// only mention a website issue if it was actually checked.
export const OUTREACH_TEMPLATES = {
  en: {
    label: "English",
    dir: "ltr",
    text: `Hi! 👋 I came across your business online and wanted to reach out.

I’m a web and mobile app developer, and I help businesses build and improve websites, develop custom systems and mobile applications, and implement AI automations to streamline their operations.

I was wondering if you have any digital projects, website improvements, or automation ideas that you’d like to explore. I’d be happy to discuss how I could help!

Would you be open to a quick chat? 😊`,
  },
  ar: {
    label: "العربية",
    dir: "rtl",
    text: `مرحباً! 👋 صادفت نشاطكم التجاري على الإنترنت وأحببت التواصل معكم.

أنا مطوّر مواقع وتطبيقات جوال، وأساعد الأنشطة التجارية في إنشاء المواقع الإلكترونية وتطويرها، وبناء أنظمة مخصصة وتطبيقات جوال، وتطبيق حلول الأتمتة بالذكاء الاصطناعي لتسهيل أعمالهم.

هل لديكم أي مشاريع رقمية، أو تحسينات على موقعكم، أو أفكار للأتمتة ترغبون في استكشافها؟ يسعدني أن نناقش كيف يمكنني المساعدة!

هل يناسبكم أن نتحدث قليلاً؟ 😊`,
  },
} as const;

export type OutreachLanguage = keyof typeof OUTREACH_TEMPLATES;

export const DEFAULT_OUTREACH_MESSAGE = OUTREACH_TEMPLATES.en.text;

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

const PERSONAL_GREETING: Record<OutreachLanguage, (name: string) => string> = {
  en: (name) => `Hi ${name} team! 👋 I came across your business online and wanted to reach out.`,
  ar: (name) => `مرحباً فريق ${name}! 👋 صادفت نشاطكم التجاري على الإنترنت وأحببت التواصل معكم.`,
};

const OBSERVATION_CLOSE: Record<OutreachLanguage, string> = {
  en: "I’d be happy to help with that.",
  ar: "ويسعدني المساعدة في ذلك.",
};

/**
 * Personalised draft: the business name in the greeting and, after the intro,
 * only the observations the operator confirmed by looking at the site.
 */
export function buildDraft({
  language,
  name,
  sentences,
}: {
  language: OutreachLanguage;
  name: string | null;
  sentences: string[];
}): string {
  const paragraphs = OUTREACH_TEMPLATES[language].text.split("\n\n");
  if (name) paragraphs[0] = PERSONAL_GREETING[language](name);
  if (sentences.length > 0) paragraphs.splice(2, 0, `${sentences.join(" ")} ${OBSERVATION_CLOSE[language]}`);
  return paragraphs.join("\n\n");
}

/**
 * Opens WhatsApp with the draft pre-filled for one recipient. The operator
 * still reviews and presses send; nothing is sent automatically.
 */
export function whatsappHref(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
