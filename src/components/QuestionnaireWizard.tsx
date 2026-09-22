"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  QUESTIONS,
  FOLLOW_UP_DATE_TARGETS,
  type QuestionnaireAnswer,
  type QuestionnaireQuestion,
} from "@/lib/questionnaire";
import { getTrackedLegalTasks } from "@/lib/maintenance-tasks";
import { submitQuestionnaireStep, completeQuestionnaire } from "@/app/actions";
import type { QuestionnaireStepEffects } from "@/lib/questionnaire-effects";

type PendingFollowUp = { question: QuestionnaireQuestion; answer: QuestionnaireAnswer };
type PendingDateAsk = { equipmentTypeId: string; taskId: string; taskTitle: string };

function isSkipped(question: QuestionnaireQuestion, answers: Record<string, string[]>): boolean {
  if (!question.skipIf) return false;
  return question.skipIf.some((cond) => (answers[cond.question] ?? []).includes(cond.answer));
}

function nextQuestion(
  answers: Record<string, string[]>,
  afterOrder: number
): QuestionnaireQuestion | null {
  return QUESTIONS.find((q) => q.order > afterOrder && !isSkipped(q, answers)) ?? null;
}

const CARD_CLASS =
  "flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900";
const OPTION_CLASS =
  "flex items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 hover:border-emerald-400 cursor-pointer dark:border-zinc-700 dark:text-zinc-100";
const BUTTON_CLASS =
  "rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST_BUTTON_CLASS =
  "rounded-lg border border-zinc-300 px-4 py-2.5 font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

export function QuestionnaireWizard({
  placeId,
  existingEquipmentTypeIds,
}: {
  placeId: string;
  existingEquipmentTypeIds: string[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [currentQuestion, setCurrentQuestion] = useState<QuestionnaireQuestion | null>(
    QUESTIONS.find((q) => !isSkipped(q, {})) ?? null
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingFollowUps, setPendingFollowUps] = useState<PendingFollowUp[]>([]);
  const [pendingDateAsks, setPendingDateAsks] = useState<PendingDateAsk[]>([]);
  // Equipment types whose date was already asked as a follow-up (REGLE-01, answered or
  // skipped) in this step: the generic date-ask pass must not ask again for them.
  const [dateAskedViaFollowUp, setDateAskedViaFollowUp] = useState<Set<string>>(new Set());
  const [placeEquipmentTypeIds, setPlaceEquipmentTypeIds] = useState<Set<string>>(
    new Set(existingEquipmentTypeIds)
  );
  const [submitting, setSubmitting] = useState(false);

  // Accumulated across the main question and any follow-ups it triggers, submitted as
  // one step once every sub-phase for this question is resolved.
  const [stepEffects, setStepEffects] = useState<QuestionnaireStepEffects>({
    placeId,
    createEquipmentTypeIds: [],
    dateAnswers: [],
    unknownChecks: [],
  });

  // "automatic" questions (the mandatory smoke detector) have nothing to ask: the
  // single answer always applies, submitted as soon as this question is reached. Every
  // hook must run unconditionally, so this sits above the early returns below.
  useEffect(() => {
    if (currentQuestion?.answerType === "automatic" && pendingFollowUps.length === 0 && pendingDateAsks.length === 0) {
      handleMainSubmit([currentQuestion.answers[0].label]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion]);

  if (!currentQuestion) {
    return (
      <div className={CARD_CLASS}>
        <p className="text-zinc-700 dark:text-zinc-300">
          C&apos;est terminé pour ce lieu. Vous pourrez toujours ajouter des appareils un par un ensuite.
        </p>
        <button
          className={BUTTON_CLASS}
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            await completeQuestionnaire(placeId);
          }}
        >
          {submitting ? "…" : "Terminer"}
        </button>
      </div>
    );
  }

  async function finishStepAndAdvance(finalEffects: QuestionnaireStepEffects) {
    setSubmitting(true);
    await submitQuestionnaireStep(finalEffects);
    const updatedPlaceEquipmentTypeIds = new Set([...placeEquipmentTypeIds, ...finalEffects.createEquipmentTypeIds]);
    setPlaceEquipmentTypeIds(updatedPlaceEquipmentTypeIds);
    const next = nextQuestion(answers, currentQuestion!.order);
    setCurrentQuestion(next);
    // A checklist shows what's already there as a starting point (never auto-removed
    // if unchecked: submitting only ever finds-or-creates the boxes left checked).
    setSelected(
      next?.answerType === "checklist"
        ? next.answers.filter((a) => a.creates.some((id) => updatedPlaceEquipmentTypeIds.has(id))).map((a) => a.label)
        : []
    );
    setPendingFollowUps([]);
    setPendingDateAsks([]);
    setDateAskedViaFollowUp(new Set());
    setStepEffects({ placeId, createEquipmentTypeIds: [], dateAnswers: [], unknownChecks: [] });
    setSubmitting(false);
    if (!next) router.refresh();
  }

  function computeDateAsks(equipmentTypeIds: string[], alreadyTargeted: Set<string>): PendingDateAsk[] {
    const asks: PendingDateAsk[] = [];
    for (const typeId of equipmentTypeIds) {
      if (placeEquipmentTypeIds.has(typeId) || alreadyTargeted.has(typeId)) continue;
      for (const task of getTrackedLegalTasks(typeId)) {
        if (task.frequency.months >= 12) {
          asks.push({ equipmentTypeId: typeId, taskId: task.id, taskTitle: task.title });
        }
      }
    }
    return asks;
  }

  function proceedAfterFollowUps(effects: QuestionnaireStepEffects, askedViaFollowUp: Set<string> = dateAskedViaFollowUp) {
    const alreadyTargeted = new Set([
      ...effects.dateAnswers.map((d) => d.equipmentTypeId),
      ...askedViaFollowUp,
    ]);
    const asks = computeDateAsks(effects.createEquipmentTypeIds, alreadyTargeted);
    if (asks.length > 0) {
      setStepEffects(effects);
      setPendingDateAsks(asks);
    } else {
      void finishStepAndAdvance(effects);
    }
  }

  function handleMainSubmit(answerLabels: string[] = selected) {
    const question = currentQuestion!;
    const chosenAnswers = question.answers.filter((a) => answerLabels.includes(a.label));
    const effects: QuestionnaireStepEffects = {
      placeId,
      createEquipmentTypeIds: chosenAnswers.flatMap((a) => a.creates),
      dateAnswers: [],
      unknownChecks: chosenAnswers
        .filter((a) => a.unknown)
        .map((a) => ({ questionId: question.id, questionLabel: question.question, help: a.help })),
    };
    if (question.id === "Q01") {
      const sets = chosenAnswers[0]?.sets;
      if (sets) effects.setPropertyType = sets.property_type as QuestionnaireStepEffects["setPropertyType"];
    }
    const followUps = chosenAnswers
      .filter((a) => a.followUp)
      .map((a) => ({ question, answer: a }));
    setAnswers((prev) => ({ ...prev, [question.id]: chosenAnswers.map((a) => a.label) }));
    if (followUps.length > 0) {
      setStepEffects(effects);
      setPendingFollowUps(followUps);
    } else {
      proceedAfterFollowUps(effects);
    }
  }

  function handleFollowUpAnswer(kind: "yes" | "no" | "unknown", dateValue?: string) {
    const { question, answer } = pendingFollowUps[0];
    const followUp = answer.followUp!;
    const target = FOLLOW_UP_DATE_TARGETS[`${question.id}|${answer.label}`];
    const effects = { ...stepEffects };
    // React state updates are async: compute the up-to-date set locally so the
    // dateAsk pass below (same tick, if this was the last follow-up) sees it too.
    let updatedDateAskedViaFollowUp = dateAskedViaFollowUp;

    if (target) {
      // A date-target follow-up stands in for the REGLE-01 last-service-date question:
      // "Je ne sais pas" just leaves the field unset (-> "à planifier"), same as REGLE-01,
      // not a REGLE-02 "à vérifier" item. Either way, the generic date-ask pass must not
      // ask again for this type.
      if (dateValue) {
        effects.dateAnswers = [...effects.dateAnswers, { equipmentTypeId: target.equipmentTypeId, field: target.field, date: dateValue }];
      }
      updatedDateAskedViaFollowUp = new Set([...dateAskedViaFollowUp, target.equipmentTypeId]);
      setDateAskedViaFollowUp(updatedDateAskedViaFollowUp);
    } else if (kind === "yes") {
      effects.createEquipmentTypeIds = [...effects.createEquipmentTypeIds, ...followUp.createsIfYes];
    } else if (kind === "unknown") {
      effects.unknownChecks = [...effects.unknownChecks, { questionId: question.id, questionLabel: followUp.question, help: null }];
    }

    const remaining = pendingFollowUps.slice(1);
    setPendingFollowUps(remaining);
    if (remaining.length > 0) {
      setStepEffects(effects);
    } else {
      proceedAfterFollowUps(effects, updatedDateAskedViaFollowUp);
    }
  }

  function handleDateAskAnswer(dateValue: string | null) {
    const ask = pendingDateAsks[0];
    const effects = { ...stepEffects };
    if (dateValue) {
      effects.dateAnswers = [
        ...effects.dateAnswers,
        { equipmentTypeId: ask.equipmentTypeId, field: "last_service_date", date: dateValue },
      ];
    }
    const remaining = pendingDateAsks.slice(1);
    setPendingDateAsks(remaining);
    if (remaining.length > 0) {
      setStepEffects(effects);
    } else {
      void finishStepAndAdvance(effects);
    }
  }

  if (pendingDateAsks.length > 0) {
    const ask = pendingDateAsks[0];
    return (
      <DateAskCard
        title={ask.taskTitle}
        onAnswer={handleDateAskAnswer}
        submitting={submitting}
      />
    );
  }

  if (pendingFollowUps.length > 0) {
    const { question, answer } = pendingFollowUps[0];
    const target = FOLLOW_UP_DATE_TARGETS[`${question.id}|${answer.label}`];
    if (target) {
      return (
        <DateAskCard
          title={answer.followUp!.question}
          dateType={target.field === "known_due_date" ? "date" : "month"}
          future={target.field === "known_due_date"}
          onAnswer={(value) => handleFollowUpAnswer(value ? "yes" : "unknown", value ?? undefined)}
          submitting={submitting}
        />
      );
    }
    return (
      <YesNoCard
        question={answer.followUp!.question}
        onAnswer={(kind) => handleFollowUpAnswer(kind)}
        submitting={submitting}
      />
    );
  }

  if (currentQuestion.answerType === "automatic") {
    return (
      <div className={CARD_CLASS}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">…</p>
      </div>
    );
  }

  return (
    <div className={CARD_CLASS}>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {currentQuestion.block === "maintenance" ? "Entretien (facultatif)" : "Question"}
      </p>
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{currentQuestion.question}</h2>
      <div className="flex flex-col gap-2">
        {currentQuestion.answers.map((answer) => {
          const isChecked = selected.includes(answer.label);
          const inputType = currentQuestion.answerType === "single" ? "radio" : "checkbox";
          return (
            <label
              key={answer.label}
              className={`${OPTION_CLASS} ${answer.unknown ? "text-zinc-400 dark:text-zinc-500" : ""}`}
            >
              <input
                type={inputType}
                name="answer"
                checked={isChecked}
                onChange={() => {
                  if (inputType === "radio") {
                    setSelected([answer.label]);
                  } else {
                    setSelected((prev) =>
                      isChecked ? prev.filter((l) => l !== answer.label) : [...prev, answer.label]
                    );
                  }
                }}
                className="mt-0.5"
              />
              <span>
                {answer.label}
                {answer.help && (
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{answer.help}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      <button
        className={BUTTON_CLASS}
        disabled={(currentQuestion.answerType !== "checklist" && selected.length === 0) || submitting}
        onClick={() => handleMainSubmit()}
      >
        {submitting ? "…" : "Suivant"}
      </button>
    </div>
  );
}

function YesNoCard({
  question,
  onAnswer,
  submitting,
}: {
  question: string;
  onAnswer: (kind: "yes" | "no" | "unknown") => void;
  submitting: boolean;
}) {
  return (
    <div className={CARD_CLASS}>
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{question}</h2>
      <div className="flex flex-wrap gap-2">
        <button className={BUTTON_CLASS} disabled={submitting} onClick={() => onAnswer("yes")}>
          Oui
        </button>
        <button className={GHOST_BUTTON_CLASS} disabled={submitting} onClick={() => onAnswer("no")}>
          Non
        </button>
      </div>
      <button
        className="self-start text-xs text-zinc-400 hover:underline dark:text-zinc-500"
        disabled={submitting}
        onClick={() => onAnswer("unknown")}
      >
        Je ne sais pas
      </button>
    </div>
  );
}

function DateAskCard({
  title,
  dateType = "month",
  future = false,
  onAnswer,
  submitting,
}: {
  title: string;
  dateType?: "month" | "date";
  future?: boolean;
  onAnswer: (value: string | null) => void;
  submitting: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <div className={CARD_CLASS}>
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{title}</h2>
      <input
        type={dateType}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        max={future ? undefined : new Date().toISOString().slice(0, dateType === "month" ? 7 : 10)}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
      <div className="flex flex-wrap gap-2">
        <button
          className={BUTTON_CLASS}
          disabled={!value || submitting}
          onClick={() => onAnswer(dateType === "month" ? `${value}-01` : value)}
        >
          Valider
        </button>
      </div>
      <button
        className="self-start text-xs text-zinc-400 hover:underline dark:text-zinc-500"
        disabled={submitting}
        onClick={() => onAnswer(null)}
      >
        Je ne sais pas
      </button>
    </div>
  );
}
