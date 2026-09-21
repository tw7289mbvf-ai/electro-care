export const CATEGORIES = [
  "Cuisine",
  "Buanderie",
  "Chauffage & Climatisation",
  "Nettoyage",
  "Petit électroménager",
  "Électronique",
  "Autre",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Appliance = {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: Category;
  purchaseDate: string;
  createdAt: string;
};
