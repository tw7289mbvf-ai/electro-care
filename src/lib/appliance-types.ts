import categoriesSeed from "../../seed/categories.json";

const sortedCategories = [...categoriesSeed].sort((a, b) => a.order - b.order);

export const CATEGORIES = sortedCategories.map((c) => c.key) as [string, ...string[]];

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = Object.fromEntries(
  sortedCategories.map((c) => [c.key, c.label])
);

export type Appliance = {
  id: string;
  name: string | null;
  brand: string | null;
  model: string | null;
  category: Category;
  purchaseDate: string | null;
  createdAt: string;
  placeId: string;
  room: string | null;
  equipmentTypeId: string | null;
};
