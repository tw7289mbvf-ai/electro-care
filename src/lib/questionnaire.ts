import questionnaireSeed from "../../seed/onboarding_questionnaire.json";

export type QuestionnaireAnswer = {
  label: string;
  creates: string[];
  help: string | null;
  followUp: { question: string; createsIfYes: string[] } | null;
  unknown: boolean;
  sets?: { property_type: string };
};

export type QuestionnaireQuestion = {
  id: string;
  block: "context" | "legal" | "maintenance";
  order: number;
  question: string;
  answerType: "single" | "multiple" | "automatic" | "checklist";
  skipIf: { question: string; answer: string }[] | null;
  answers: QuestionnaireAnswer[];
};

export const QUESTIONS: QuestionnaireQuestion[] = [...questionnaireSeed.questions]
  .sort((a, b) => a.order - b.order)
  .map((q) => ({
    id: q.id,
    block: q.block as QuestionnaireQuestion["block"],
    order: q.order,
    question: q.question,
    answerType: q.answer_type as QuestionnaireQuestion["answerType"],
    skipIf: q.skip_if ? q.skip_if.map((s) => ({ question: s.question, answer: s.answer })) : null,
    answers: q.answers.map((a) => ({
      label: a.label,
      creates: a.creates,
      help: a.help,
      followUp: a.follow_up ? { question: a.follow_up.question, createsIfYes: a.follow_up.creates_if_yes } : null,
      unknown: a.unknown,
      sets: "sets" in a ? (a.sets as { property_type: string }) : undefined,
    })),
  }));

// Follow-up questions with no creates_if_yes ask for a date rather than gating equipment
// creation; the seed has no generic hook for which equipment type, which task or which
// date field that is (an answer can create several types, e.g. Q06 creates both CUIS-03
// and CUIS-04, and a type can carry more than one tracked task, e.g. SEC-01), so each is
// mapped explicitly here — including the exact task id, never inferred from array order
// — rather than guessed from its text. Keyed by "questionId|answerLabel".
export type FollowUpDateTarget = {
  equipmentTypeId: string;
  taskId: string;
  field: "last_service_date" | "known_due_date";
};

export const FOLLOW_UP_DATE_TARGETS: Record<string, FollowUpDateTarget> = {
  // Q06 (cuisson au gaz): "Date de péremption imprimée sur le tuyau flexible" — a future
  // expiry date, so it primes the calculation (see src/lib/obligations.ts).
  "Q06|Oui": { equipmentTypeId: "CUIS-04", taskId: "T-060", field: "known_due_date" },
  // Q07 (assainissement non collectif): "Date du dernier contrôle du SPANC et de la
  // dernière vidange" — this *is* the REGLE-01 last-service-date question, just asked
  // as this answer's follow-up instead of separately.
  "Q07|Non, fosse septique ou fosse toutes eaux": {
    equipmentTypeId: "ASS-01",
    taskId: "T-072",
    field: "last_service_date",
  },
  "Q07|Non, micro-station d'épuration": {
    equipmentTypeId: "ASS-02",
    taskId: "T-075",
    field: "last_service_date",
  },
  // Q10 (véhicules): "Date de première immatriculation et du dernier contrôle
  // technique" — simplified to the last technical inspection date only; the first-
  // registration nuance for a car younger than its first inspection interval is a
  // known simplification for v1 (falls back to "à planifier" via "Je ne sais pas").
  "Q10|Voiture": { equipmentTypeId: "VEH-01", taskId: "T-152", field: "last_service_date" },
  "Q10|Moto, scooter ou quadricycle": { equipmentTypeId: "VEH-02", taskId: "T-153", field: "last_service_date" },
};
