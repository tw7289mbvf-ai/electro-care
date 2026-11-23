import type { ServiceConfidence } from "@/lib/obligations";

// A date question's answer (asked once during onboarding, or again later to resolve an
// orange "Mettre à jour"): a precise date (last_service_date), a fixed due date
// (known_due_date — an expiry, or a vehicle's registration + threshold), or (REGLE-01) a
// graded answer with no exact date.
export type DateAnswerResult = { date: string } | { dueDate: string } | { confidence: Exclude<ServiceConfidence, null> };

export function dateAnswerToObligationFields(result: DateAnswerResult): {
  lastServiceDate?: string | null;
  knownDueDate?: string | null;
  serviceConfidence?: ServiceConfidence;
} {
  if ("date" in result) return { lastServiceDate: result.date };
  if ("dueDate" in result) return { knownDueDate: result.dueDate };
  return { serviceConfidence: result.confidence };
}

// The "jamais, elle/il a moins de N ans" branch (vehicle_inspection): wording and
// threshold are seed-authored (seed/date_questions.json's note field), copied here
// since the seed has no structured field for either.
export const VEHICLE_YOUNG_OPTION: Record<string, { label: string; years: number }> = {
  "T-152": { label: "Jamais, elle a moins de 4 ans", years: 4 },
  "T-153": { label: "Jamais, il a moins de 5 ans", years: 5 },
};

export function addYearsIso(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split("-");
  return `${Number(y) + years}-${m}-${d}`;
}

// T-060, the gas hose (spec "Obligations and Maintenance", decided 2026-11-23): two
// answers besides the printed expiry date. A metal hose has no expiry at all (compliant,
// shown « Sans date limite »); a rigid connection has no hose, so the obligation does not
// apply (« Non concerné », grey, out of the gauge). Seed-authored wording, kept here like
// VEHICLE_YOUNG_OPTION since seed/date_questions.json has no structured field for it.
export const EXPIRY_EXTRA_OPTIONS: Record<
  string,
  { help: string; options: { label: string; confidence: "compliant" | "not_applicable" }[] }
> = {
  "T-060": {
    help: "Un flexible métallique (inox) porte la mention \"à durée de vie illimitée\". Un flexible en caoutchouc porte une date limite d'utilisation.",
    options: [
      { label: "Flexible métallique, sans date limite", confidence: "compliant" },
      { label: "Raccordement rigide, pas de flexible", confidence: "not_applicable" },
    ],
  },
};
