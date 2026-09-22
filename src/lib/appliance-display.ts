import type { Appliance } from "@/lib/appliance-types";
import { CATEGORY_LABELS } from "@/lib/appliance-types";
import { getEquipmentType } from "@/lib/equipment-types";

// A name typed by the user is shown as-is. Otherwise, fall back to the equipment
// type's label, or the category's, then complete it with brand and room when known.
export function getApplianceDisplayName(appliance: Appliance): string {
  if (appliance.name) return appliance.name;

  const base = getEquipmentType(appliance.equipmentTypeId)?.label ?? CATEGORY_LABELS[appliance.category];
  const parts = [base, appliance.brand, appliance.room].filter(
    (part): part is string => Boolean(part)
  );
  return parts.join(" · ");
}
