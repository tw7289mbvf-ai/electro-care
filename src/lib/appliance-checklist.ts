import { QUESTIONS } from "@/lib/questionnaire";

// The questionnaire's appliance checklist (Q20), reused as is by the place page's
// "Voulez-vous le suivre ?" card and "Ajouter plusieurs appareils" (spec, Maintenance
// Levels).
export const APPLIANCE_CHECKLIST_ITEMS: { label: string; equipmentTypeIds: string[] }[] = QUESTIONS.find(
  (q) => q.id === "Q20"
)!.answers.map((a) => ({ label: a.label, equipmentTypeIds: a.creates }));

export const APPLIANCE_CHECKLIST_EQUIPMENT_TYPE_IDS = new Set(
  APPLIANCE_CHECKLIST_ITEMS.flatMap((item) => item.equipmentTypeIds)
);

const PLURAL_HEADS = new Set([
  "canalisations", "combles", "fenêtres", "gouttières", "grilles", "panneaux", "radiateurs", "volets",
]);
const FEMININE_HEADS = new Set([
  "alarme", "batterie", "borne", "cave", "charpente", "chaudière", "cheminée", "citerne", "cuve", "façade",
  "fosse", "hotte", "installation", "machine", "micro-station", "pac", "plaque", "pompe", "porte", "terrasse",
  "toiture", "tondeuse", "videosurveillance", "vmc", "voiture",
]);

// "ce lave-linge", "cette hotte", "cet aspirateur", "ces volets roulants": the unticking
// warning names the appliance the way the spec does. Acronyms keep their capitals.
export function withDemonstrative(label: string): string {
  const [first, ...rest] = label.split(" ");
  const head = first.toLowerCase().replace(/,$/, "");
  const shown = [first === first.toUpperCase() ? first : first.toLowerCase(), ...rest].join(" ");
  if (PLURAL_HEADS.has(head)) return `ces ${shown}`;
  if (FEMININE_HEADS.has(head)) return `cette ${shown}`;
  if (/^[aeiouyéèh]/i.test(head)) return `cet ${shown}`;
  return `ce ${shown}`;
}
