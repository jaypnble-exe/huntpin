import "server-only";
import type { BBox } from "../places/areas";
import { normalizeEmails } from "../places/emails";
import { classifyWebPresence, hasInstagram } from "../places/webPresence";
import type { PlaceRow } from "./placesImport";

// Foursquare OS Places (Apache-2.0, "Copyright 2024 Foursquare Labs, Inc.
// All rights reserved."), read from the Places Portal Iceberg catalog.
export const FSQ_CATALOG_ENDPOINT = "https://catalog.h3-hub.foursquare.com/iceberg";
export const FSQ_TABLE = "fsq.datasets.places_os";
/** Only places updated since this date are imported (older ones are often stale). */
export const DEFAULT_REFRESHED_SINCE = "2024-01-01";

// Top-level Foursquare categories that are businesses worth contacting.
const BUSINESS_TOP_LEVELS = new Set([
  "Dining and Drinking",
  "Retail",
  "Business and Professional Services",
  "Health and Medicine",
  "Arts and Entertainment",
  "Sports and Recreation",
]);

// First match wins: Foursquare label pattern → Overture-style basic_category,
// so the app's category groups and scoring work for both sources.
const CATEGORY_RULES: [RegExp, string][] = [
  [/Coffee Shop/i, "coffee_shop"],
  [/Café|Cafe, Coffee, and Tea House|Tea Room/i, "cafe"],
  [/Fast Food|Burger|Sandwich|Shawarma|Fried Chicken|Pizzeria/i, "fast_food_restaurant"],
  [/Juice Bar|Smoothie/i, "smoothie_juice_bar"],
  [/Bakery|Dessert|Ice Cream|Donut|Pastry|Chocolate|Candy|Sweet/i, "food_and_beverage_store"],
  [/Hookah|Lounge/i, "lounge"],
  [/> Bar/i, "bar"],
  [/Restaurant|Steakhouse|Diner|Food Court|Buffet|Breakfast/i, "restaurant"],
  [/Dining and Drinking/i, "casual_eatery"],
  [/Barbershop|Hair Salon|Nail Salon|Beauty Salon|Spa|Massage|Health and Beauty Service|Tattoo|Waxing|Eyebrow/i, "personal_or_beauty_service"],
  [/Gym|Fitness|Yoga|Pilates|Martial Arts|Boxing/i, "gym"],
  [/Dentist|Dental/i, "dental_clinic"],
  [/Pharmacy|Drugstore/i, "pharmacy_and_drug_store"],
  [/Hospital/i, "hospital"],
  [/Health and Medicine/i, "health_care"],
  [/Clothing|Fashion|Shoe|Boutique|Abaya|Tailor|Jewelry|Accessories|Bridal/i, "fashion_and_apparel_store"],
  [/Electronics|Mobile Phone|Computer/i, "electronics_store"],
  [/Cosmetics|Perfume|Beauty Supply/i, "personal_care_and_beauty_store"],
  [/Flower|Florist|Gift/i, "flowers_and_gifts_store"],
  [/Sporting Goods|Sports Store/i, "sporting_goods_store"],
  [/Hardware|Furniture|Home Store|Home Improvement|Garden|Lighting|Carpet/i, "hardware_home_and_garden_store"],
  [/Arts and Crafts|Hobby|Toy/i, "arts_crafts_and_hobby_store"],
  [/Bookstore|Book Store|Music Store|Video Store/i, "books_music_and_video_store"],
  [/Department Store/i, "department_store"],
  [/Shopping Mall|Shopping Plaza/i, "shopping_mall"],
  [/Grocery|Supermarket|Convenience|Butcher|Market|Food and Beverage|Dates|Spice|Nut/i, "food_and_beverage_store"],
  [/Retail/i, "shopping"],
  [/Car Dealership|Auto Dealership/i, "auto_dealer"],
  [/Automotive|Car Wash|Auto |Tire|Mechanic/i, "automotive_service"],
  [/Real Estate/i, "real_estate_service"],
  [/Event|Wedding|Party/i, "event_or_party_service"],
  [/Laundry|Dry Cleaner|Cleaning|Plumber|Electrician|Home Service|Pest Control|Contractor/i, "home_service"],
  [/Lawyer|Law Firm|Attorney|Legal/i, "attorney_or_law_firm"],
  [/Print|Copy/i, "printing_service"],
  [/Design|Advertising|Marketing|Media|Photograph/i, "design_service"],
  [/Pet|Veterinar/i, "animal_or_pet_service"],
  [/Travel Agency|Tour/i, "travel_service"],
  [/School|Education|Tutor|Training|Academy|Language/i, "specialty_school"],
  [/Hotel|Lodging|Motel|Resort|Apartment Hotel|Hostel/i, "hotel"],
  [/Business and Professional Services/i, "professional_service"],
  [/Arts and Entertainment|Sports and Recreation/i, "arts_and_entertainment"],
];

export function mapFoursquareCategory(label: string | null): string | null {
  if (!label) return null;
  return CATEGORY_RULES.find(([pattern]) => pattern.test(label))?.[1] ?? null;
}

export function isBusinessCategory(label: string | null): boolean {
  if (!label) return false;
  const top = label.split(" > ")[0];
  return BUSINESS_TOP_LEVELS.has(top) || label.startsWith("Travel and Transportation > Lodging");
}

export function foursquareQuery(bbox: BBox): string {
  if (bbox.some((n) => !Number.isFinite(n))) throw new Error("invalid bbox");
  const [west, south, east, north] = bbox;
  return `
    SELECT fsq_place_id, name, latitude, longitude, date_refreshed, date_closed, tel, email, website,
           facebook_id, instagram, twitter, fsq_category_labels
    FROM ${FSQ_TABLE}
    WHERE longitude BETWEEN ${west} AND ${east} AND latitude BETWEEN ${south} AND ${north}
  `;
}

export interface FoursquarePlace {
  fsq_place_id: unknown;
  name: unknown;
  latitude: unknown;
  longitude: unknown;
  date_refreshed: unknown;
  date_closed: unknown;
  tel: unknown;
  email?: unknown;
  website: unknown;
  facebook_id: unknown;
  instagram: unknown;
  twitter: unknown;
  fsq_category_labels: unknown;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

const HANDLE = /^[A-Za-z0-9._]{1,60}$/;

export function instagramUrl(handle: unknown): string | null {
  const h = text(handle)?.replace(/^@/, "");
  return h && HANDLE.test(h) ? `https://www.instagram.com/${h}` : null;
}

function socialUrls(raw: FoursquarePlace): string[] {
  const urls: string[] = [];
  const ig = instagramUrl(raw.instagram);
  if (ig) urls.push(ig);
  const fb = raw.facebook_id;
  if ((typeof fb === "number" || typeof fb === "string" || typeof fb === "bigint") && /^\d{1,20}$/.test(String(fb))) {
    urls.push(`https://www.facebook.com/${fb}`);
  }
  const tw = text(raw.twitter)?.replace(/^@/, "");
  if (tw && HANDLE.test(tw)) urls.push(`https://x.com/${tw}`);
  return urls;
}

export interface FsqOptions {
  area: string;
  release: string;
  refreshedSince: string;
}

/**
 * Maps one Foursquare record to a place row, or null when it should not be
 * imported: closed, stale, not a business category, or unusable.
 */
export function toFoursquarePlaceRow(raw: FoursquarePlace, { area, release, refreshedSince }: FsqOptions): PlaceRow | null {
  const fsqId = text(raw.fsq_place_id);
  const lat = Number(raw.latitude);
  const lon = Number(raw.longitude);
  if (!fsqId || !/^[A-Za-z0-9]{1,64}$/.test(fsqId)) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (text(raw.date_closed)) return null;
  const refreshed = text(raw.date_refreshed)?.slice(0, 10) ?? null;
  if (!refreshed || refreshed < refreshedSince) return null;

  const labels = Array.isArray(raw.fsq_category_labels) ? raw.fsq_category_labels.filter((l): l is string => typeof l === "string") : [];
  const primary = labels[0] ?? null;
  if (!isBusinessCategory(primary)) return null;

  const website = text(raw.website);
  const websites = website ? [website] : [];
  const socials = socialUrls(raw);
  const tel = text(raw.tel);

  return {
    id: `fsq:${fsqId}`,
    source: "foursquare",
    source_release: release,
    area,
    name: text(raw.name),
    basic_category: mapFoursquareCategory(primary),
    taxonomy_primary: primary,
    websites,
    socials,
    phones: tel ? [tel] : [],
    emails: normalizeEmails(raw.email),
    // Foursquare rarely records websites, so "nothing listed" means unknown.
    web_presence: websites.length || socials.length ? classifyWebPresence({ websites, socials, operatingStatus: null }) : "unknown",
    has_instagram: hasInstagram({ websites, socials }),
    confidence: null,
    operating_status: null,
    lat,
    lon,
    source_datasets: ["Foursquare"],
    source_licenses: ["Apache-2.0"],
    refreshed_on: refreshed,
    chain_size: 1,
    lead_score: 0,
  };
}

/**
 * DuckDB SQL matching Foursquare places (table f) to Overture places (table o)
 * already on the map: same Foursquare record id, or a similar name within
 * about 60 m. A grid join keeps it fast.
 */
export const MATCH_SQL = `
  CREATE OR REPLACE TABLE o_cells AS
    SELECT o.*, cast(floor(o.lat / 0.0006) AS BIGINT) + dy AS cy, cast(floor(o.lon / 0.0006) AS BIGINT) + dx AS cx
    FROM o, (SELECT unnest([-1, 0, 1]) AS dy), (SELECT unnest([-1, 0, 1]) AS dx);
  CREATE OR REPLACE TABLE matches AS
    SELECT f.fsq_place_id, any_value(o.id) AS overture_id
    FROM f JOIN o ON list_contains(o.record_ids, f.fsq_place_id)
    GROUP BY 1
    UNION ALL
    SELECT f.fsq_place_id, arg_max(c.id, jaro_winkler_similarity(lower(f.name), lower(c.name))) AS overture_id
    FROM f JOIN o_cells c
      ON c.cy = cast(floor(f.latitude / 0.0006) AS BIGINT) AND c.cx = cast(floor(f.longitude / 0.0006) AS BIGINT)
    WHERE f.name IS NOT NULL AND c.name IS NOT NULL
      AND abs(f.latitude - c.lat) < 0.00055 AND abs(f.longitude - c.lon) < 0.0006
      AND jaro_winkler_similarity(lower(f.name), lower(c.name)) >= 0.88
      AND f.fsq_place_id NOT IN (SELECT fsq_place_id FROM f JOIN o ON list_contains(o.record_ids, f.fsq_place_id))
    GROUP BY 1;
`;
