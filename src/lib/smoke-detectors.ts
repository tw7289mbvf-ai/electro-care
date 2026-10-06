// The three kinds of smoke detector (spec, Onboarding Questionnaire, "Smoke detector"),
// one equipment type each so the type carries its own tasks and obligations:
// standalone (SEC-01: monthly test, replacement date), linked to an alarm that isn't
// monitored (SEC-08: monthly test from the alarm's app, replacement date), linked to a
// monitored alarm (SEC-09: followed by the provider, one-time CE EN 14604 check).
export const SMOKE_DETECTOR_TYPES = {
  standalone: "SEC-01",
  alarm: "SEC-08",
  monitored: "SEC-09",
} as const;

export type SmokeDetectorKind = keyof typeof SMOKE_DETECTOR_TYPES;

// The one question each kind still needs answered when a detector switches to it: the
// date printed on its back (replacement), or the CE EN 14604 marking (monitored).
export const SMOKE_DETECTOR_QUESTION_TASK: Record<SmokeDetectorKind, string> = {
  standalone: "T-083",
  alarm: "T-156",
  monitored: "T-158",
};

// Tasks tracked from the switch itself, with no question (kind "none"): the monthly test.
export const SMOKE_DETECTOR_START_TASKS: Record<SmokeDetectorKind, string[]> = {
  standalone: ["T-082"],
  alarm: ["T-155"],
  monitored: [],
};

export const SMOKE_DETECTOR_KIND_LABELS: Record<SmokeDetectorKind, string> = {
  standalone: "Détecteur autonome",
  alarm: "Relié à mon alarme",
  monitored: "Relié à mon alarme télésurveillée",
};

export function getSmokeDetectorKind(equipmentTypeId: string | null): SmokeDetectorKind | null {
  for (const [kind, typeId] of Object.entries(SMOKE_DETECTOR_TYPES)) {
    if (typeId === equipmentTypeId) return kind as SmokeDetectorKind;
  }
  return null;
}
