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
};
