import { describe, expect, it } from "vitest";
import { deriveOpportunities, detectSignals } from "./websiteSignals";

const MODERN = `<!doctype html><html lang="ar" dir="rtl"><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.salla.network/app.js"></script></head>
<body><h1>مرحبا بكم في متجرنا للحلويات والقهوة المختصة في جدة</h1>
<form action="/contact"><input name="email"></form>
<a href="https://calendly.com/shop">Book</a></body></html>`;

const OLD = `<html><head><title>Cafe One</title><style>body{color:red}</style></head>
<body><h1>Welcome to Cafe One</h1><p>Order now:
<a href="https://hungerstation.com/sa-en/restaurant/1">HungerStation</a>
<a href="https://www.jahez.net/x">Jahez</a></p>
<a href="tel:+966500000000">Call</a> <a href="https://wa.me/966500000000">WhatsApp</a>
<script>var arabic = "قهوة قهوة قهوة قهوة قهوة قهوة قهوة";</script></body></html>`;

describe("detectSignals", () => {
  it("reads a modern Arabic store page", () => {
    expect(detectSignals(MODERN, { finalUrl: "https://shop.sa/", responseMs: 400 })).toEqual({
      version: 1,
      https: true,
      socialOnly: false,
      responseMs: 400,
      htmlRead: true,
      mobileViewport: true,
      htmlLang: "ar",
      hasArabic: true,
      placeholder: false,
      deliveryApps: [],
      bookingTools: ["Calendly"],
      sitePlatform: "Salla",
      hasForm: true,
      whatsappLink: false,
      phoneLink: false,
    });
  });

  it("reads an older English-only page and ignores Arabic inside scripts", () => {
    const signals = detectSignals(OLD, { finalUrl: "http://cafe.sa/", responseMs: 4200 });
    expect(signals).toMatchObject({
      https: false,
      mobileViewport: false,
      htmlLang: null,
      hasArabic: false,
      deliveryApps: ["HungerStation", "Jahez"],
      hasForm: false,
      whatsappLink: true,
      phoneLink: true,
      sitePlatform: null,
    });
  });

  it("spots placeholder pages in English and Arabic", () => {
    expect(detectSignals("<html><body>Coming Soon!</body></html>", { finalUrl: "https://a.sa/", responseMs: 1 }).placeholder).toBe(true);
    expect(detectSignals("<html><body>الموقع تحت الإنشاء</body></html>", { finalUrl: "https://a.sa/", responseMs: 1 }).placeholder).toBe(true);
    expect(detectSignals("<html><body>This domain is for sale</body></html>", { finalUrl: "https://a.sa/", responseMs: 1 }).placeholder).toBe(true);
  });

  it("marks social final URLs and unread HTML", () => {
    const signals = detectSignals(null, { finalUrl: "https://linktr.ee/cafe", responseMs: 100 });
    expect(signals).toMatchObject({ socialOnly: true, htmlRead: false, mobileViewport: null, hasArabic: null });
  });
});

describe("deriveOpportunities", () => {
  const keys = (args: Parameters<typeof deriveOpportunities>[0]) => deriveOpportunities(args).map((o) => o.key);

  it("lists checkable opportunities for an older restaurant site", () => {
    const signals = detectSignals(OLD, { finalUrl: "http://cafe.sa/", responseMs: 4200 });
    expect(keys({ websiteStatus: "reachable", errorCategory: null, signals, category: "restaurant" })).toEqual([
      "no_https",
      "slow",
      "no_viewport",
      "no_arabic",
      "delivery_apps",
      "no_form",
    ]);
  });

  it("finds little to suggest for a modern store, apart from noting the platform", () => {
    const signals = detectSignals(MODERN, { finalUrl: "https://shop.sa/", responseMs: 400 });
    expect(keys({ websiteStatus: "reachable", errorCategory: null, signals, category: "cafe" })).toEqual([
      "no_online_ordering",
      "store_platform",
    ]);
  });

  it("suggests booking for clinics without a booking tool or form", () => {
    const html = '<html lang="ar"><head><meta name="viewport" content="x"></head><body><a href="tel:1">اتصل بنا الآن للحجز في عيادتنا</a></body></html>';
    const signals = detectSignals(html, { finalUrl: "https://clinic.sa/", responseMs: 300 });
    expect(keys({ websiteStatus: "reachable", errorCategory: null, signals, category: "dental_clinic" })).toEqual(["no_booking"]);
  });

  it("handles failed checks and social-only sites", () => {
    expect(keys({ websiteStatus: "unreachable", errorCategory: "dns_not_found", signals: null, category: null })).toEqual(["unreachable"]);
    expect(keys({ websiteStatus: "needs_manual_review", errorCategory: "tls_error", signals: null, category: null })).toEqual(["tls_error"]);
    const social = detectSignals(null, { finalUrl: "https://www.instagram.com/cafe", responseMs: 100 });
    expect(keys({ websiteStatus: "reachable", errorCategory: null, signals: social, category: "cafe" })).toEqual(["social_only"]);
  });

  it("gives every outreach sentence in English and Arabic", () => {
    const signals = detectSignals(OLD, { finalUrl: "http://cafe.sa/", responseMs: 4200 });
    for (const opportunity of deriveOpportunities({ websiteStatus: "reachable", errorCategory: null, signals, category: "restaurant" })) {
      if (!opportunity.sentence) continue;
      expect(opportunity.sentence.en.length).toBeGreaterThan(10);
      expect(opportunity.sentence.ar).toMatch(/[؀-ۿ]/);
    }
  });
});
