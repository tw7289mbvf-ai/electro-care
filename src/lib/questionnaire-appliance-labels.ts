// equipment_types.json labels are workbook text (unaccented ASCII, per seed/README.md
// "Known gaps") and not meant for display. This is the small, proofread subset actually
// named in questionnaire follow-ups and date requests (REGLE-01, REGLE-03): every
// equipment type id that can be the subject of a follow-up question or a date-ask,
// computed from seed/onboarding_questionnaire.json's "creates" and date-target lists.
export const QUESTIONNAIRE_APPLIANCE_LABELS: Record<string, string> = {
  "ASS-01": "La fosse toutes eaux ou fosse septique",
  "ASS-02": "La micro-station d'épuration",
  "CH-01": "La chaudière au gaz",
  "CH-02": "La chaudière au fioul",
  "CH-03": "La chaudière bois ou granulés",
  "CH-04": "Le poêle à granulés",
  "CH-05": "Le poêle ou l'insert à bois",
  "CH-06": "La cheminée à foyer ouvert",
  "CH-07": "Le conduit de fumée",
  "CH-08": "La pompe à chaleur air/eau",
  "CH-09": "La pompe à chaleur air/air réversible",
  "CH-10": "La pompe à chaleur géothermique",
  "CH-16": "La citerne de gaz propane",
  "CLIM-01": "Le climatiseur",
  "CUIS-04": "Le tuyau flexible de gaz",
  "EAU-05": "Le puits ou forage",
  "ECS-02": "Le chauffe-eau thermodynamique",
  "ECS-03": "Le chauffe-eau au gaz",
  "PIS-01": "La piscine",
  "SEC-01": "Le détecteur de fumée",
  "VEH-01": "La voiture",
  "VEH-02": "Le deux-roues, trois-roues ou quadricycle motorisé",
};

export function getQuestionnaireApplianceLabel(equipmentTypeId: string | undefined): string | undefined {
  return equipmentTypeId ? QUESTIONNAIRE_APPLIANCE_LABELS[equipmentTypeId] : undefined;
}
