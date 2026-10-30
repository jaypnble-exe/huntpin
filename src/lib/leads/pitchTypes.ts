// Business types for outreach pitches: finer than the map's category groups,
// so a gym and a salon, or a café and a restaurant, get different pitches.
// Built from the `basic_category` values in the Jeddah data (Overture and
// Foursquare). A category not listed here falls back to its group's pitch.

export const PITCH_TYPES = {
  cafe: {
    label: "Cafés & coffee",
    categories: ["cafe", "coffee_shop", "smoothie_juice_bar", "lounge", "bar", "non_alcoholic_beverage_venue"],
  },
  restaurant: {
    label: "Restaurants",
    categories: ["restaurant", "casual_eatery", "fast_food_restaurant", "food_truck_stand", "food_service", "food_and_drink"],
  },
  food_store: { label: "Sweets, bakeries & food shops", categories: ["food_and_beverage_store", "convenience_store"] },
  salon: { label: "Salons & barbers", categories: ["personal_or_beauty_service"] },
  spa: { label: "Spas & wellness", categories: ["wellness_service", "complementary_and_alternative_medicine"] },
  gym: {
    label: "Gyms & fitness",
    categories: ["gym", "sport_or_fitness_facility", "fitness_studio", "sport_or_recreation_club", "swimming_pool"],
  },
  clinic: {
    label: "Clinics & dentists",
    categories: [
      "dental_clinic",
      "health_care",
      "outpatient_care_facility",
      "specialized_health_care",
      "vision_or_eye_care_clinic",
      "physical_medicine_and_rehabilitation",
      "behavioral_or_mental_health_clinic",
      "reproductive_perinatal_and_womens_care",
      "medical_service",
      "surgery",
    ],
  },
  hospital: { label: "Hospitals & labs", categories: ["hospital", "diagnostics_imaging_or_lab_service"] },
  pharmacy: { label: "Pharmacies", categories: ["pharmacy_and_drug_store"] },
  fashion: { label: "Fashion & beauty shops", categories: ["fashion_and_apparel_store", "personal_care_and_beauty_store"] },
  electronics: { label: "Electronics & mobile shops", categories: ["electronics_store"] },
  building: {
    label: "Building materials & contractors",
    categories: ["hardware_home_and_garden_store", "building_or_construction_service"],
  },
  gifts: {
    label: "Flowers, gifts & hobby shops",
    categories: ["flowers_and_gifts_store", "toys_and_games_store", "arts_crafts_and_hobby_store"],
  },
  events: { label: "Events & parties", categories: ["event_or_party_service", "event_venue"] },
  real_estate: { label: "Real estate", categories: ["real_estate_service", "condominium"] },
  travel: { label: "Travel agencies", categories: ["travel_service", "travel_and_transportation"] },
  home_service: { label: "Home services & maintenance", categories: ["home_service", "technical_service", "laundry_service"] },
  office: {
    label: "Offices & professional services",
    categories: [
      "professional_service",
      "corporate_or_business_office",
      "b2b_service",
      "b2b_office_and_professional_service",
      "financial_service",
      "design_service",
      "media_service",
      "printing_service",
    ],
  },
  legal: { label: "Lawyers", categories: ["attorney_or_law_firm", "legal_service"] },
  car_service: { label: "Car service & parts", categories: ["automotive_service", "vehicle_parts_store", "vehicle_service"] },
  car_dealer: { label: "Car dealers & rentals", categories: ["auto_dealer", "vehicle_dealer", "rental_service"] },
  hotel: { label: "Hotels & stays", categories: ["hotel", "lodging", "resort", "bed_and_breakfast", "private_lodging"] },
  school: {
    label: "Schools & training",
    categories: [
      "place_of_learning",
      "specialty_school",
      "education",
      "educational_service",
      "preschool",
      "elementary_school",
      "middle_school",
      "high_school",
    ],
  },
  entertainment: {
    label: "Entertainment & attractions",
    categories: ["arts_and_entertainment", "amusement_park", "arcade", "music_venue", "movie_theater"],
  },
  logistics: {
    label: "Suppliers, factories & logistics",
    categories: [
      "manufacturer",
      "supplier_or_distributor",
      "wholesaler",
      "b2b_transportation_and_storage_service",
      "shipping_or_delivery_service",
      "storage_facility",
    ],
  },
  pets: { label: "Pet shops & vets", categories: ["animal_or_pet_service", "animal_and_pet_store"] },
} as const satisfies Record<string, { label: string; categories: readonly string[] }>;

export type PitchType = keyof typeof PITCH_TYPES;

export const PITCH_TYPE_KEYS = Object.keys(PITCH_TYPES) as PitchType[];

export function isPitchType(value: string): value is PitchType {
  return Object.hasOwn(PITCH_TYPES, value);
}

/** The pitch type for a `basic_category`, if any. */
export function pitchTypeOf(category: string | null): PitchType | null {
  if (!category) return null;
  for (const key of PITCH_TYPE_KEYS) {
    if ((PITCH_TYPES[key].categories as readonly string[]).includes(category)) return key;
  }
  return null;
}
