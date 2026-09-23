import equipmentTypesSeed from "../../seed/equipment_types.json";
import type { Category } from "@/lib/appliance-types";

export type EquipmentType = {
  id: string;
  category: Category;
  label: string;
  legalStatus: "yes" | "conditional" | "no";
};

// legalStatus decides "à confirmer" (src/lib/obligations.ts) and isn't needed by any
// client component: ApplianceForm receives a {id, category, label}-only projection
// (see src/app/page.tsx) so this field never reaches the client bundle.
export const EQUIPMENT_TYPES: EquipmentType[] = equipmentTypesSeed.map((t) => ({
  id: t.id,
  category: t.category as Category,
  label: t.label,
  legalStatus: t.legal.status as "yes" | "conditional" | "no",
}));

const EQUIPMENT_TYPES_BY_ID = new Map(EQUIPMENT_TYPES.map((t) => [t.id, t]));

export function getEquipmentType(id: string | null | undefined): EquipmentType | undefined {
  return id ? EQUIPMENT_TYPES_BY_ID.get(id) : undefined;
}
