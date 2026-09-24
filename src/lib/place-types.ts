import enumsSeed from "../../seed/enums.json";

export const PROPERTY_TYPES = enumsSeed.property_type.map((p) => p.key) as [string, ...string[]];

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = Object.fromEntries(
  enumsSeed.property_type.map((p) => [p.key, p.label])
);

export type Place = {
  id: string;
  name: string;
  commune: string | null;
  postcode: string | null;
  propertyType: PropertyType | null;
  createdAt: string;
  onboardedAt: string | null;
};

// Dashboard order: main home, second home, long-term rental, short-term rental (the
// order PROPERTY_TYPES is already declared in, from seed/enums.json), places without a
// property type last. Sort is stable, so createdAt order survives within each group.
export function comparePlacesByPropertyType(a: Place, b: Place): number {
  const rank = (p: Place) => (p.propertyType ? PROPERTY_TYPES.indexOf(p.propertyType) : PROPERTY_TYPES.length);
  return rank(a) - rank(b);
}
