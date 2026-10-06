import type { Appliance } from "@/lib/appliance-types";
import { CATEGORY_LABELS } from "@/lib/appliance-types";
import { getEquipmentType } from "@/lib/equipment-types";
import { SMOKE_DETECTOR_NAME, getSmokeDetectorKind } from "@/lib/smoke-detectors";

// A name typed by the user is shown as-is. Otherwise, fall back to the equipment
// type's label, or the category's, then complete it with brand and room when known.
export function getApplianceDisplayName(appliance: Appliance): string {
  if (appliance.name) return appliance.name;

  // Smoke detectors: one name whatever the kind (standalone, linked, monitored), the kind
  // being shown apart, as the fiche's subtitle.
  const base = getSmokeDetectorKind(appliance.equipmentTypeId)
    ? SMOKE_DETECTOR_NAME
    : (getEquipmentType(appliance.equipmentTypeId)?.label ?? CATEGORY_LABELS[appliance.category]);
  const parts = [base, appliance.brand, appliance.room].filter(
    (part): part is string => Boolean(part)
  );
  return parts.join(", ");
}
