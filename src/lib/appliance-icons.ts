import equipmentTypesSeed from "../../seed/equipment_types.json";
import type { Appliance, Category } from "@/lib/appliance-types";
import type { IconName } from "@/components/ui";

// One line icon per appliance (docs/design.md, "Icônes"): from the equipment type's
// technical group when known, else from its category. Fire-based heating (stoves,
// chimneys, flues) and heat pumps get their own icon within "Chauffage".
const CATEGORY_ICONS: Record<Category, IconName> = {
  kitchen: "cooking",
  laundry: "washer",
  heating_cooling: "boiler",
  small_appliances: "plug",
  electronics: "screen",
  garden_pool: "garden",
  home_safety: "detector",
  energy: "energy",
  vehicles: "vehicle",
  other: "other",
};

const GROUP_ICONS: Record<string, IconName> = {
  Chauffage: "boiler",
  Climatisation: "cold",
  "Eau chaude": "water",
  Ventilation: "ventilation",
  Energie: "energy",
  Jardin: "garden",
  Piscine: "water",
  Assainissement: "water",
  Bati: "home",
  Eau: "water",
  Ouvrants: "opening",
  Securite: "detector",
  Cuisson: "cooking",
  Froid: "fridge",
  Lavage: "washer",
  "Petit electromenager": "plug",
  Vehicules: "vehicle",
};

const FIRE_PATTERN = /poêle|chemin|conduit|bois/i;
const HEAT_PUMP_PATTERN = /pompe à chaleur|PAC /i;

const ICON_BY_TYPE_ID = new Map<string, IconName>(
  equipmentTypesSeed.map((t) => {
    let icon = GROUP_ICONS[t.technical_group] ?? CATEGORY_ICONS[t.category] ?? "other";
    if (t.technical_group === "Chauffage" && FIRE_PATTERN.test(t.label)) icon = "fire";
    if (t.technical_group === "Chauffage" && HEAT_PUMP_PATTERN.test(t.label)) icon = "cold";
    return [t.id, icon];
  })
);

export function getApplianceIconName(appliance: Pick<Appliance, "equipmentTypeId" | "category">): IconName {
  return (
    (appliance.equipmentTypeId ? ICON_BY_TYPE_ID.get(appliance.equipmentTypeId) : undefined) ??
    CATEGORY_ICONS[appliance.category] ??
    "other"
  );
}
