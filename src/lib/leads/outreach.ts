// Outreach drafts. Drafts only: nothing here sends a message. The operator
// edits, copies, and sends each one manually.
import { CATEGORY_GROUPS, type CategoryGroup } from "../places/categories";
import { PITCH_TYPE_KEYS, PITCH_TYPES, type PitchType } from "./pitchTypes";

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
  /** Replaces the first message's general question for businesses of that type. */
  typePitches: Record<PitchType, string>;
  /** Fallback for businesses whose type has no pitch: one per category group. */
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
    typePitches: {
      cafe: "For cafés, I build things like digital QR menus, online pre-ordering for pickup, and simple loyalty programs, so regulars order from you directly.",
      restaurant: "For restaurants, I build things like digital QR menus, online ordering and table bookings, so customers can order from you directly, not only through delivery apps.",
      food_store: "For sweets shops, bakeries and food stores, I build online catalogues with WhatsApp ordering, and pre-orders for occasions and large orders.",
      salon: "For salons and barbershops, I build websites with online booking and reminders, so clients can book without calling or messaging.",
      spa: "For spas and wellness centres, I build websites with online booking, packages and gift cards, plus reminders for clients.",
      gym: "For gyms and fitness studios, I build websites and apps for memberships, class bookings and member check-ins.",
      clinic: "For clinics, I build websites with online appointment booking, doctor profiles and patient reminders, which make it easier for new patients to find and choose you.",
      hospital: "For hospitals and labs, I build appointment booking, online results access and patient portals, plus internal systems to cut paperwork.",
      pharmacy: "For pharmacies, I build online ordering with WhatsApp or delivery, and simple systems for stock and repeat prescriptions.",
      fashion: "For fashion and beauty shops, I build online stores with WhatsApp ordering, so customers can browse your collections and order any time.",
      electronics: "For electronics and mobile shops, I build online stores with stock and prices, plus systems to track repairs and warranties.",
      building: "For building materials and contracting, I build websites with product catalogues, quote requests and project galleries, plus simple systems for orders and deliveries.",
      gifts: "For flower, gift and hobby shops, I build online stores with delivery booking and occasion orders, so customers can order ahead.",
      events: "For event and party services, I build websites with portfolios, packages and online booking requests.",
      real_estate: "For real estate offices, I build websites with property listings, search and enquiry forms, plus systems to manage listings and clients.",
      travel: "For travel agencies, I build websites with packages, visa and booking requests, plus systems to manage customers and bookings.",
      home_service: "For home services and maintenance, I build websites where customers can book a visit or request a quote online, plus systems to schedule jobs.",
      office: "For offices and professional services, I build websites that present your services and team, with enquiry forms, plus internal systems and automations for everyday work.",
      legal: "For law firms, I build professional websites with consultation booking, plus systems to manage cases and client documents.",
      car_service: "For car service and parts, I build websites with service booking, price requests and parts catalogues, plus systems to track jobs and customers.",
      car_dealer: "For car dealers and rentals, I build websites with car listings, booking and enquiry forms, plus systems to manage the fleet.",
      hotel: "For hotels and stays, I build websites with direct booking, so guests can reserve with you without booking-site commissions.",
      school: "For schools and training centres, I build websites with online registration, course pages and portals for parents or students.",
      entertainment: "For entertainment venues, I build websites with online ticketing, event calendars and bookings.",
      logistics: "For suppliers, factories and logistics, I build websites with product catalogues and quote requests, plus systems for orders, stock and shipments.",
      pets: "For pet shops and vets, I build websites with online booking for grooming or visits, and online ordering for supplies.",
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
    typePitches: {
      cafe: "للمقاهي، أبني حلولاً مثل المنيو الرقمي برمز QR، والطلب المسبق أونلاين للاستلام، وبرامج ولاء بسيطة، ليطلب عملاؤكم الدائمون منكم مباشرة.",
      restaurant: "للمطاعم، أبني حلولاً مثل المنيو الرقمي برمز QR، والطلب أونلاين، وحجز الطاولات، ليطلب العملاء منكم مباشرة وليس فقط عبر تطبيقات التوصيل.",
      food_store: "لمحلات الحلويات والمخابز والأغذية، أبني كتالوجات أونلاين مع الطلب عبر واتساب، والطلبات المسبقة للمناسبات والكميات الكبيرة.",
      salon: "للصالونات ومحلات الحلاقة، أبني مواقع مع حجز المواعيد أونلاين والتذكيرات، ليحجز العملاء دون الحاجة للاتصال أو المراسلة.",
      spa: "لمراكز السبا والعناية، أبني مواقع مع الحجز أونلاين، والباقات وبطاقات الهدايا، إضافة إلى تذكيرات للعملاء.",
      gym: "للنوادي الرياضية واستوديوهات اللياقة، أبني مواقع وتطبيقات للاشتراكات وحجز الحصص وتسجيل حضور الأعضاء.",
      clinic: "للعيادات، أبني مواقع مع حجز المواعيد أونلاين، وصفحات تعريفية للأطباء، وتذكيرات للمرضى، مما يسهّل على المرضى الجدد إيجادكم واختياركم.",
      hospital: "للمستشفيات والمختبرات، أبني أنظمة لحجز المواعيد، والاطلاع على النتائج أونلاين، وبوابات للمرضى، إضافة إلى أنظمة داخلية تقلّل الأعمال الورقية.",
      pharmacy: "للصيدليات، أبني الطلب أونلاين عبر واتساب أو التوصيل، وأنظمة بسيطة للمخزون والوصفات المتكررة.",
      fashion: "لمحلات الأزياء ومستحضرات التجميل، أبني متاجر إلكترونية مع الطلب عبر واتساب، ليتصفح العملاء تشكيلاتكم ويطلبوا في أي وقت.",
      electronics: "لمحلات الإلكترونيات والجوالات، أبني متاجر إلكترونية تعرض المنتجات والأسعار، إضافة إلى أنظمة لمتابعة الصيانة والضمان.",
      building: "لمواد البناء والمقاولات، أبني مواقع مع كتالوج المنتجات وطلب عروض الأسعار ومعرض المشاريع، إضافة إلى أنظمة بسيطة للطلبات والتوصيل.",
      gifts: "لمحلات الورد والهدايا والهوايات، أبني متاجر إلكترونية مع حجز التوصيل وطلبات المناسبات، ليطلب العملاء مسبقاً.",
      events: "لخدمات المناسبات والحفلات، أبني مواقع تعرض أعمالكم وباقاتكم مع طلبات الحجز أونلاين.",
      real_estate: "لمكاتب العقار، أبني مواقع لعرض العقارات مع البحث ونماذج الاستفسار، إضافة إلى أنظمة لإدارة العروض والعملاء.",
      travel: "لوكالات السفر، أبني مواقع تعرض الباقات وتستقبل طلبات التأشيرات والحجوزات، إضافة إلى أنظمة لإدارة العملاء والحجوزات.",
      home_service: "لخدمات المنازل والصيانة، أبني مواقع يحجز فيها العملاء زيارة أو يطلبون عرض سعر أونلاين، إضافة إلى أنظمة لجدولة الأعمال.",
      office: "للمكاتب والخدمات المهنية، أبني مواقع تعرض خدماتكم وفريقكم مع نماذج للاستفسار، إضافة إلى أنظمة داخلية وأتمتة للأعمال اليومية.",
      legal: "لمكاتب المحاماة، أبني مواقع احترافية مع حجز الاستشارات، إضافة إلى أنظمة لإدارة القضايا ومستندات العملاء.",
      car_service: "لصيانة السيارات وقطع الغيار، أبني مواقع مع حجز مواعيد الصيانة وطلب الأسعار وكتالوج القطع، إضافة إلى أنظمة لمتابعة الطلبات والعملاء.",
      car_dealer: "لمعارض وتأجير السيارات، أبني مواقع تعرض السيارات مع الحجز ونماذج الاستفسار، إضافة إلى أنظمة لإدارة الأسطول.",
      hotel: "للفنادق وأماكن الإقامة، أبني مواقع مع الحجز المباشر، ليحجز الضيوف معكم دون عمولات مواقع الحجز.",
      school: "للمدارس ومراكز التدريب، أبني مواقع مع التسجيل أونلاين، وصفحات للدورات، وبوابات لأولياء الأمور والطلاب.",
      entertainment: "لأماكن الترفيه، أبني مواقع مع بيع التذاكر أونلاين وتقويم الفعاليات والحجوزات.",
      logistics: "للموردين والمصانع وشركات الشحن، أبني مواقع مع كتالوج المنتجات وطلب عروض الأسعار، إضافة إلى أنظمة للطلبات والمخزون والشحنات.",
      pets: "لمحلات الحيوانات الأليفة والعيادات البيطرية، أبني مواقع مع حجز مواعيد العناية أو الزيارات، والطلب أونلاين للمستلزمات.",
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
  typePitches: Object.fromEntries(PITCH_TYPE_KEYS.map((key) => [key, PARAGRAPH])),
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

// ---------------------------------------------------------------------------
// Pitch choice: the business type's pitch, else its group's, else the
// general question. The operator can override it per draft (the data's
// category is sometimes wrong).

export type PitchChoice = "general" | `type:${PitchType}` | `group:${CategoryGroup}`;

function choiceText(t: LanguageTemplates, choice: PitchChoice): string {
  if (choice.startsWith("type:")) return t.typePitches[choice.slice(5) as PitchType]?.trim() ?? "";
  if (choice.startsWith("group:")) return t.pitches[choice.slice(6) as CategoryGroup]?.trim() ?? "";
  return "";
}

/** The pitch used when the operator hasn't picked one. */
export function autoPitch(t: LanguageTemplates, pitchType: PitchType | null, group: CategoryGroup | null): PitchChoice {
  if (pitchType && choiceText(t, `type:${pitchType}`)) return `type:${pitchType}`;
  if (group && choiceText(t, `group:${group}`)) return `group:${group}`;
  return "general";
}

export function pitchLabel(choice: PitchChoice): string {
  if (choice.startsWith("type:")) return PITCH_TYPES[choice.slice(5) as PitchType].label;
  if (choice.startsWith("group:")) return CATEGORY_GROUPS[choice.slice(6) as CategoryGroup].label;
  return "General question";
}

export function isPitchChoice(value: string): value is PitchChoice {
  if (value === "general") return true;
  if (value.startsWith("type:")) return Object.hasOwn(PITCH_TYPES, value.slice(5));
  if (value.startsWith("group:")) return Object.hasOwn(CATEGORY_GROUPS, value.slice(6));
  return false;
}

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
  pitchType = null,
  pitch,
  templates = DEFAULT_TEMPLATES,
}: {
  language: OutreachLanguage;
  name: string | null;
  sentences: string[];
  kind?: DraftKind;
  portfolio?: { mode: PortfolioMode; url: string | null };
  category?: CategoryGroup | null;
  pitchType?: PitchType | null;
  /** Overrides the automatic pitch. */
  pitch?: PitchChoice;
  templates?: OutreachTemplates;
}): string {
  const t = templates[language];
  const message = kind === "first" ? t.first : t.followUp;
  const greeting = name ? message.greetingNamed.split("{name}").join(name) : message.greeting;
  const pitchText = choiceText(t, pitch ?? autoPitch(t, pitchType, category));
  const paragraphs =
    kind === "first"
      ? [greeting, t.first.intro, pitchText || t.first.question, t.first.closing]
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
