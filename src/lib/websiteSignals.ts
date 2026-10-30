// Website review signals: objective, checkable facts about a homepage.
// Shared by the server (detection) and the browser (display). Signals are
// hints to verify, never proof that a site is "bad" or "outdated".
import { humanizeCategory } from "./places/categories";
import { isSocialUrl } from "./places/webPresence";

export const SLOW_RESPONSE_MS = 3000;

export interface WebsiteSignals {
  version: 1;
  /** Final page served over HTTPS. */
  https: boolean;
  /** Final address is a social profile, link-in-bio or chat link. */
  socialOnly: boolean;
  /** Time until the final page's response headers arrived. */
  responseMs: number | null;
  /** Whether the first part of the HTML could be read. Other HTML signals are null when false. */
  htmlRead: boolean;
  mobileViewport: boolean | null;
  htmlLang: string | null;
  hasArabic: boolean | null;
  placeholder: boolean | null;
  deliveryApps: string[];
  bookingTools: string[];
  sitePlatform: string | null;
  hasForm: boolean | null;
  whatsappLink: boolean | null;
  phoneLink: boolean | null;
}

const MAX_HTML_LENGTH = 256 * 1024;

const PLACEHOLDER_PATTERNS = [
  /coming soon/i,
  /under construction/i,
  /this domain (is|may be) for sale/i,
  /buy this domain/i,
  /domain (is )?parked/i,
  /parked (free|domain)/i,
  /sedoparking|parkingcrew|bodis\.com|dan\.com\/buy/i,
  /website is under maintenance/i,
  /قريباً|قريبا/,
  /تحت الإنشاء|تحت الانشاء/,
];

const DELIVERY_APPS: [string, RegExp][] = [
  ["HungerStation", /hungerstation\.com/i],
  ["Jahez", /jahez\.net/i],
  ["Talabat", /talabat\.com/i],
  ["Mrsool", /mrsool\.co/i],
  ["ToYou", /toyou\.io/i],
  ["Keeta", /keeta(app)?\.com/i],
  ["The Chefz", /thechefz\.co/i],
  ["Careem", /careem\.com/i],
];

const BOOKING_TOOLS: [string, RegExp][] = [
  ["Calendly", /calendly\.com/i],
  ["Fresha", /fresha\.com/i],
  ["Booksy", /booksy\.com/i],
  ["Setmore", /setmore\.com/i],
  ["Vagaro", /vagaro\.com/i],
  ["SimplyBook", /simplybook\.(me|it)/i],
  ["OpenTable", /opentable\.com/i],
  ["SevenRooms", /sevenrooms\.com/i],
  ["Square Appointments", /squareup\.com\/appointments/i],
];

const PLATFORMS: [string, RegExp][] = [
  ["Salla", /salla\.(sa|network)|cdn\.salla/i],
  ["Zid", /zid\.(store|sa)|zidcdn/i],
  ["Shopify", /cdn\.shopify\.com|myshopify\.com/i],
  ["Wix", /wixstatic\.com|static\.wixstatic|wix\.com/i],
  ["Squarespace", /squarespace\.com|static1\.squarespace/i],
  ["Webflow", /webflow\.(com|io)|assets\.website-files\.com/i],
  ["WordPress", /wp-content\/|wp-includes\//i],
];

function found(html: string, list: [string, RegExp][]): string[] {
  return list.filter(([, pattern]) => pattern.test(html)).map(([name]) => name);
}

/** Visible-ish text: drops scripts, styles and tags. Good enough for language hints. */
function roughText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

export function detectSignals(
  html: string | null,
  { finalUrl, responseMs }: { finalUrl: string; responseMs: number | null },
): WebsiteSignals {
  const https = finalUrl.startsWith("https:");
  const socialOnly = isSocialUrl(finalUrl);
  const base = { version: 1 as const, https, socialOnly, responseMs };

  if (html === null) {
    return {
      ...base,
      htmlRead: false,
      mobileViewport: null,
      htmlLang: null,
      hasArabic: null,
      placeholder: null,
      deliveryApps: [],
      bookingTools: [],
      sitePlatform: null,
      hasForm: null,
      whatsappLink: null,
      phoneLink: null,
    };
  }

  const page = html.slice(0, MAX_HTML_LENGTH);
  const text = roughText(page);
  const lang = page.match(/<html[^>]*\slang\s*=\s*["']?([a-zA-Z-]{2,10})/i)?.[1]?.toLowerCase() ?? null;
  const arabicChars = (text.match(/[؀-ۿ]/g) ?? []).length;

  return {
    ...base,
    htmlRead: true,
    mobileViewport: /<meta[^>]+name\s*=\s*["']?viewport/i.test(page),
    htmlLang: lang,
    hasArabic: arabicChars >= 20 || (lang?.startsWith("ar") ?? false),
    placeholder: PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text)),
    deliveryApps: found(page, DELIVERY_APPS),
    bookingTools: found(page, BOOKING_TOOLS),
    sitePlatform: found(page, PLATFORMS)[0] ?? null,
    hasForm: /<form[\s>]/i.test(page),
    whatsappLink: /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//i.test(page),
    phoneLink: /href\s*=\s*["']?tel:/i.test(page),
  };
}

export interface Opportunity {
  key: string;
  title: string;
  detail: string;
  /** Sentence for the outreach draft, only for confirmed, factual observations. */
  sentence?: { en: string; ar: string };
}

const BOOKING_CATEGORY = /dental|clinic|health|medical|care|beauty|salon|spa|wellness|gym|fitness/i;
const FOOD_CATEGORY = /restaurant|eatery|cafe|coffee|food|bakery|dessert|juice|bar|lounge/i;

/** Turns stored check results into "possible opportunities" for the operator to verify. */
export function deriveOpportunities({
  websiteStatus,
  errorCategory,
  signals,
  category,
}: {
  websiteStatus: string | null;
  errorCategory: string | null;
  signals: WebsiteSignals | null;
  category: string | null;
}): Opportunity[] {
  const out: Opportunity[] = [];

  if (websiteStatus === "unreachable") {
    out.push({
      key: "unreachable",
      title: "Website did not load",
      detail: "Check it yourself in a browser first; it may be a temporary problem.",
      sentence: {
        en: "I tried to visit your website and it didn’t load for me.",
        ar: "حاولت زيارة موقعكم ولكنه لم يفتح لدي.",
      },
    });
  }
  if (errorCategory === "tls_error") {
    out.push({
      key: "tls_error",
      title: "HTTPS certificate problem",
      detail: "Visitors may see a security warning.",
      sentence: {
        en: "I noticed your website’s security certificate isn’t working, so visitors may see a warning.",
        ar: "لاحظت أن شهادة الأمان في موقعكم لا تعمل، لذلك قد تظهر للزوار رسالة تحذير.",
      },
    });
  }
  if (!signals) return out;

  if (signals.socialOnly) {
    out.push({
      key: "social_only",
      title: "Website link goes to a social page",
      detail: "Their listed website ends on a social profile or link page, not their own site.",
      sentence: {
        en: "I noticed your website link goes to a social media page rather than your own site.",
        ar: "لاحظت أن رابط موقعكم يوجّه إلى صفحة تواصل اجتماعي بدلاً من موقع خاص بكم.",
      },
    });
    return out;
  }
  if (!signals.https) {
    out.push({
      key: "no_https",
      title: "No HTTPS",
      detail: "Browsers mark the site as “Not secure”.",
      sentence: {
        en: "I noticed your website doesn’t use a secure (HTTPS) connection, so browsers show it as “Not secure”.",
        ar: "لاحظت أن موقعكم لا يستخدم اتصالاً آمناً (HTTPS)، لذلك تعرضه المتصفحات على أنه «غير آمن».",
      },
    });
  }
  if (signals.responseMs !== null && signals.responseMs > SLOW_RESPONSE_MS) {
    out.push({
      key: "slow",
      title: `Slow first response (${(signals.responseMs / 1000).toFixed(1)} s)`,
      detail: "Measured once from this computer; check again before mentioning it.",
      sentence: {
        en: "Your website took a few seconds to start loading when I visited.",
        ar: "استغرق موقعكم بضع ثوانٍ ليبدأ التحميل عندما زرته.",
      },
    });
  }
  if (!signals.htmlRead) return out;

  if (signals.placeholder) {
    out.push({
      key: "placeholder",
      title: "Placeholder page",
      detail: "Shows “coming soon”, “under construction” or a domain-for-sale page.",
      sentence: {
        en: "I noticed your website currently shows a placeholder page.",
        ar: "لاحظت أن موقعكم يعرض حالياً صفحة مؤقتة.",
      },
    });
  }
  if (signals.mobileViewport === false) {
    out.push({
      key: "no_viewport",
      title: "No mobile viewport tag",
      detail: "Often means the site isn’t mobile-friendly. Open it on your phone to confirm.",
      sentence: {
        en: "Your website may not be fully optimised for mobile phones.",
        ar: "قد لا يكون موقعكم مهيأً بالكامل للجوال.",
      },
    });
  }
  if (signals.hasArabic === false) {
    out.push({
      key: "no_arabic",
      title: "No Arabic content on the homepage",
      detail: "There may be an Arabic version elsewhere; check the language switcher.",
      sentence: {
        en: "I noticed your website doesn’t seem to have an Arabic version.",
        ar: "لاحظت أن موقعكم لا يبدو أن له نسخة عربية.",
      },
    });
  }
  if (signals.deliveryApps.length > 0) {
    out.push({
      key: "delivery_apps",
      title: `Orders through delivery apps (${signals.deliveryApps.join(", ")})`,
      detail: "A direct ordering page or app could save them commission.",
      sentence: {
        en: "I saw you take orders through delivery apps. A direct ordering page on your own site could help save on commission.",
        ar: "رأيت أنكم تستقبلون الطلبات عبر تطبيقات التوصيل، وصفحة طلب مباشرة على موقعكم قد تساعد في توفير العمولات.",
      },
    });
  } else if (category && FOOD_CATEGORY.test(category)) {
    out.push({
      key: "no_online_ordering",
      title: "No online ordering found on the homepage",
      detail: `${humanizeCategory(category)}: they may still use apps not linked from the site.`,
    });
  }
  if (category && BOOKING_CATEGORY.test(category) && signals.bookingTools.length === 0 && signals.hasForm === false) {
    out.push({
      key: "no_booking",
      title: "No online booking found",
      detail: "No booking tool or form on the homepage.",
      sentence: {
        en: "I couldn’t find a way to book online on your website.",
        ar: "لم أجد طريقة للحجز عبر الإنترنت في موقعكم.",
      },
    });
  }
  if (signals.hasForm === false && (signals.whatsappLink || signals.phoneLink) && !out.some((o) => o.key === "no_booking")) {
    out.push({
      key: "no_form",
      title: "Contact by phone/WhatsApp only",
      detail: "No contact form on the homepage. A form, chatbot or WhatsApp automation could help.",
      sentence: {
        en: "I noticed customers can only reach you by phone or WhatsApp from your website.",
        ar: "لاحظت أن العملاء يستطيعون التواصل معكم من خلال موقعكم عبر الهاتف أو واتساب فقط.",
      },
    });
  }
  if (signals.sitePlatform === "Salla" || signals.sitePlatform === "Zid" || signals.sitePlatform === "Shopify") {
    out.push({
      key: "store_platform",
      title: `Online store on ${signals.sitePlatform}`,
      detail: "Already selling online: custom features, integrations or a mobile app may interest them.",
    });
  }
  return out;
}
