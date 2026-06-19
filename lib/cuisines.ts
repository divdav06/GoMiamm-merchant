// Canonical cuisine tokens for stores.cuisine. MUST stay in sync with the
// customer-app home CATEGORIES partnerCuisines (customer-app/app/(tabs)/index.tsx)
// — these are the values the customer category chips + search match against.
// stores.category (food/grocery/pharmacy/coffee/dessert/other) is the separate
// business-type and is unrelated.
export const CUISINES: { value: string; label: string }[] = [
  { value: "pizza", label: "Pizza" },
  { value: "burgers", label: "Burgers" },
  { value: "sushi", label: "Sushi" },
  { value: "mexican", label: "Mexican" },
  { value: "indian", label: "Indian" },
  { value: "chinese", label: "Chinese" },
  { value: "thai", label: "Thai" },
  { value: "italian", label: "Italian" },
  { value: "korean", label: "Korean" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "sandwiches", label: "Sandwiches" },
  { value: "seafood", label: "Seafood" },
  { value: "breakfast", label: "Breakfast" },
  { value: "coffee", label: "Coffee" },
  { value: "dessert", label: "Dessert" },
  { value: "african", label: "African" },
];

export const CUISINE_VALUES = CUISINES.map((c) => c.value);

export function isValidCuisine(v: unknown): v is string {
  return typeof v === "string" && CUISINE_VALUES.includes(v);
}
