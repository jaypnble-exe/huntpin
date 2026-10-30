// Map filter groups over Overture's `basic_category` values. Built from the
// most common categories in the Jeddah import; extend as new areas need.

export const CATEGORY_GROUPS = {
  food: {
    label: "Food & drink",
    categories: [
      "restaurant",
      "casual_eatery",
      "coffee_shop",
      "cafe",
      "fast_food_restaurant",
      "food_and_beverage_store",
      "smoothie_juice_bar",
      "food_service",
      "food_and_drink",
      "bar",
      "lounge",
    ],
  },
  retail: {
    label: "Shops",
    categories: [
      "fashion_and_apparel_store",
      "shopping",
      "electronics_store",
      "personal_care_and_beauty_store",
      "flowers_and_gifts_store",
      "sporting_goods_store",
      "hardware_home_and_garden_store",
      "arts_crafts_and_hobby_store",
      "books_music_and_video_store",
      "department_store",
      "warehouse_club_store",
      "shopping_mall",
    ],
  },
  beauty: {
    label: "Beauty & fitness",
    categories: ["personal_or_beauty_service", "wellness_service", "gym", "sport_or_fitness_facility"],
  },
  health: {
    label: "Health",
    categories: [
      "hospital",
      "pharmacy_and_drug_store",
      "dental_clinic",
      "health_care",
      "outpatient_care_facility",
      "diagnostics_imaging_or_lab_service",
    ],
  },
  services: {
    label: "Services",
    categories: [
      "professional_service",
      "real_estate_service",
      "event_or_party_service",
      "home_service",
      "technical_service",
      "building_or_construction_service",
      "printing_service",
      "design_service",
      "media_service",
      "attorney_or_law_firm",
      "animal_or_pet_service",
      "rental_service",
      "travel_service",
    ],
  },
  auto: {
    label: "Automotive",
    categories: ["automotive_service", "auto_dealer", "vehicle_parts_store", "gas_station"],
  },
  hotels: {
    label: "Hotels",
    categories: ["hotel", "lodging", "resort"],
  },
  education: {
    label: "Education",
    categories: [
      "place_of_learning",
      "specialty_school",
      "preschool",
      "education",
      "elementary_school",
      "high_school",
      "college_university",
    ],
  },
} as const;

export type CategoryGroup = keyof typeof CATEGORY_GROUPS;

export function isCategoryGroup(value: string): value is CategoryGroup {
  return Object.hasOwn(CATEGORY_GROUPS, value);
}

export function humanizeCategory(category: string | null): string {
  if (!category) return "Uncategorized";
  const text = category.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
