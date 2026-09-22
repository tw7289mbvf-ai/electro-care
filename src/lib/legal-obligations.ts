import legalObligationsSeed from "../../seed/legal_obligations.json";

export type LegalObligation = {
  id: string;
  obligation: string;
  equipmentTypeIds: string[];
  legalText: string;
  frequency: string;
  proof: string;
  sanction: string;
  risks: {
    fineMax: string | null;
    insurance: string | null;
    liability: string | null;
    danger: string | null;
    other: string | null;
  } | null;
};

const LEGAL_OBLIGATIONS: LegalObligation[] = legalObligationsSeed.map((l) => ({
  id: l.id,
  obligation: l.obligation,
  equipmentTypeIds: l.equipment_type_ids,
  legalText: l.legal_text,
  frequency: l.frequency,
  proof: l.proof,
  sanction: l.sanction,
  risks: l.risks
    ? {
        fineMax: l.risks.fine_max,
        insurance: l.risks.insurance,
        liability: l.risks.liability,
        danger: l.risks.danger,
        other: l.risks.other,
      }
    : null,
}));

// Display content only (legal text, risks, sanction) — never used to decide which
// obligations to track or when they're due. See getTrackedLegalTasks for that.
export function getLegalObligationsForType(equipmentTypeId: string): LegalObligation[] {
  return LEGAL_OBLIGATIONS.filter((l) => l.equipmentTypeIds.includes(equipmentTypeId));
}
