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
