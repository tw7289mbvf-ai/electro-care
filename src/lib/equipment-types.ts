import equipmentTypesSeed from "../../seed/equipment_types.json";
import type { Category } from "@/lib/appliance-types";

export type EquipmentType = {
  id: string;
  category: Category;
  label: string;
};

export const EQUIPMENT_TYPES: EquipmentType[] = equipmentTypesSeed.map((t) => ({
  id: t.id,
  category: t.category as Category,
  label: t.label,
}));

const EQUIPMENT_TYPES_BY_ID = new Map(EQUIPMENT_TYPES.map((t) => [t.id, t]));

export function getEquipmentType(id: string | null | undefined): EquipmentType | undefined {
  return id ? EQUIPMENT_TYPES_BY_ID.get(id) : undefined;
}

export function getEquipmentTypesForCategory(category: Category): EquipmentType[] {
  return EQUIPMENT_TYPES.filter((t) => t.category === category).sort((a, b) =>
    a.label.localeCompare(b.label, "fr")
  );
}
