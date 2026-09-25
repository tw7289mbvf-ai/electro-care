import questionnaireSeed from "../../seed/onboarding_questionnaire.json";

export type QuestionnaireAnswer = {
  label: string;
  creates: string[];
  help: string | null;
  followUp: { question: string; createsIfYes: string[] } | null;
  unknown: boolean;
  // REGLE-06: fixes the initial confidence ("never") for the named task ids directly,
  // without asking their date question.
  initialStatus: Record<string, "never"> | null;
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
      initialStatus: (a.initial_status as Record<string, "never"> | null) ?? null,
      sets: "sets" in a ? (a.sets as { property_type: string }) : undefined,
    })),
  }));
