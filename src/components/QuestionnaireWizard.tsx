"use client";

import { useEffect, useState } from "react";
import {
  QUESTIONS,
  FOLLOW_UP_DATE_TARGETS,
  type QuestionnaireAnswer,
  type QuestionnaireQuestion,
} from "@/lib/questionnaire";
import { getQuestionnaireApplianceLabel } from "@/lib/questionnaire-appliance-labels";
import { getEquipmentType } from "@/lib/equipment-types";
import { getTrackedLegalTasks } from "@/lib/maintenance-tasks";
import { submitQuestionnaireStep, completeQuestionnaire } from "@/app/actions";
import type { QuestionnaireStepEffects } from "@/lib/questionnaire-effects";
import { PROPERTY_TYPE_LABELS, type PropertyType } from "@/lib/place-types";

type PendingFollowUp = { question: QuestionnaireQuestion; answer: QuestionnaireAnswer };
// REGLE-03: a hearth appliance (poele, insert, chaudiere) created alongside its flue
// (CH-07) in the same step is asked as one combined date question, not two.
type PendingDateAsk =
  | { kind: "single"; equipmentTypeId: string; taskId: string }
  | { kind: "combined"; applianceTypeId: string; applianceTaskId: string; conduitTypeId: string; conduitTaskId: string };
// REGLE-01's graded answer to a "date du dernier passage" question.
type DateGradeResult = { date: string } | { confidence: "recent" | "old" | "never" };

// Nothing is written to the database until the final recap confirmation (see spec's
// "Back button and recap"). Each fully-answered question becomes one entry here; "Précédent"
// simply drops the tail of this list and re-asks from there — nothing was ever persisted,
// so there is no stray appliance to clean up.
type AnsweredStep = {
  question: QuestionnaireQuestion;
  answerLabels: string[];
  effects: QuestionnaireStepEffects;
};

const HEARTH_TYPE_IDS = new Set(["CH-01", "CH-02", "CH-03", "CH-04", "CH-05"]);
const Q01 = QUESTIONS.find((q) => q.id === "Q01")!;

function isSkipped(
  question: QuestionnaireQuestion,
  answers: Record<string, string[]>,
  propertyTypeAlreadyKnown: boolean
): boolean {
  // REGLE-04: Q01 isn't asked again once the place already has a property type.
  if (question.id === "Q01" && propertyTypeAlreadyKnown) return true;
  if (!question.skipIf) return false;
  return question.skipIf.some((cond) => (answers[cond.question] ?? []).includes(cond.answer));
}

function nextQuestion(
  answers: Record<string, string[]>,
  afterOrder: number,
  propertyTypeAlreadyKnown: boolean
): QuestionnaireQuestion | null {
  return QUESTIONS.find((q) => q.order > afterOrder && !isSkipped(q, answers, propertyTypeAlreadyKnown)) ?? null;
}

function emptyStepEffects(placeId: string): QuestionnaireStepEffects {
  return { placeId, createEquipmentTypeIds: [], dateAnswers: [], unknownChecks: [] };
}

// REGLE-05: {residence} names the place by its type ("votre residence principale" /
// "votre residence secondaire"). Only ever reached for a main or second home: Q10, the
// one question using it, is skipped for both rental types.
function resolveResidenceText(text: string, propertyType: PropertyType | null): string {
  if (!text.includes("{residence}")) return text;
  const phrase =
    propertyType === "main_home"
      ? "votre résidence principale"
      : propertyType === "second_home"
        ? "votre résidence secondaire"
        : "ce logement";
  return text.replaceAll("{residence}", phrase);
}

function applianceLabel(equipmentTypeId: string): string {
  return getQuestionnaireApplianceLabel(equipmentTypeId) ?? getEquipmentType(equipmentTypeId)?.label ?? equipmentTypeId;
}

function formatMonth(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${month}/${year}`;
}

function describeDateAnswer(d: QuestionnaireStepEffects["dateAnswers"][number]): string {
  if (d.field === "known_due_date") {
    return d.date ? `date de péremption : ${formatMonth(d.date)}` : "date de péremption inconnue";
  }
  if (d.date) return `dernier passage : ${formatMonth(d.date)}`;
  if (d.confidence === "recent") return "fait récemment — date à confirmer";
  if (d.confidence === "old") return "fait, il y a plus longtemps que le délai";
  return "jamais fait ou inconnu";
}

const CARD_CLASS =
  "flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900";
const OPTION_CLASS =
  "flex items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 hover:border-emerald-400 cursor-pointer dark:border-zinc-700 dark:text-zinc-100";
const BUTTON_CLASS =
  "rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST_BUTTON_CLASS =
  "rounded-lg border border-zinc-300 px-4 py-2.5 font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";
const DISCREET_LINK_CLASS = "self-start text-xs text-zinc-400 hover:underline dark:text-zinc-500";
const BACK_LINK_CLASS =
  "self-start text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400";

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={BACK_LINK_CLASS} onClick={onClick}>
      ← Précédent
    </button>
  );
}

export function QuestionnaireWizard({
  placeId,
  existingEquipmentTypeIds,
  existingPropertyType,
}: {
  placeId: string;
  existingEquipmentTypeIds: string[];
  existingPropertyType: PropertyType | null;
}) {
  const propertyTypeAlreadyKnown = existingPropertyType !== null;
  // REGLE-04: when Q01 is skipped, its answer is deduced from the place's property
  // type so skip_if conditions that depend on it (Q10, vehicles) still apply.
  const deducedQ01Answer = propertyTypeAlreadyKnown
    ? (Q01.answers.find((a) => a.sets?.property_type === existingPropertyType) ?? null)
    : null;

  function mergedAnswers(history: AnsweredStep[]): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    if (deducedQ01Answer) map.Q01 = [deducedQ01Answer.label];
    for (const step of history) map[step.question.id] = step.answerLabels;
    return map;
  }

  function effectivePropertyType(history: AnsweredStep[]): PropertyType | null {
    if (existingPropertyType) return existingPropertyType;
    return history.find((s) => s.question.id === "Q01")?.effects.setPropertyType ?? null;
  }

  const [history, setHistory] = useState<AnsweredStep[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionnaireQuestion | null>(
    nextQuestion(mergedAnswers([]), 0, propertyTypeAlreadyKnown)
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingFollowUps, setPendingFollowUps] = useState<PendingFollowUp[]>([]);
  const [pendingDateAsks, setPendingDateAsks] = useState<PendingDateAsk[]>([]);
  // Equipment types whose date was already asked as a follow-up (REGLE-01, answered or
  // skipped) in this step: the generic date-ask pass must not ask again for them.
  const [dateAskedViaFollowUp, setDateAskedViaFollowUp] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  // Accumulated across the main question and any follow-ups it triggers, folded into
  // `history` as one step once every sub-phase for this question is resolved.
  const [stepEffects, setStepEffects] = useState<QuestionnaireStepEffects>(emptyStepEffects(placeId));
  const [stepAnswerLabels, setStepAnswerLabels] = useState<string[]>([]);

  function placeEquipmentTypeIds(atHistory: AnsweredStep[] = history): Set<string> {
    return new Set([...existingEquipmentTypeIds, ...atHistory.flatMap((s) => s.effects.createEquipmentTypeIds)]);
  }

  // "automatic" questions (the mandatory smoke detector) have nothing to ask: the
  // single answer always applies, submitted as soon as this question is reached. Every
  // hook must run unconditionally, so this sits above the early returns below.
  useEffect(() => {
    if (currentQuestion?.answerType === "automatic" && pendingFollowUps.length === 0 && pendingDateAsks.length === 0) {
      handleMainSubmit([currentQuestion.answers[0].label]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion]);

  function resetStepState() {
    setPendingFollowUps([]);
    setPendingDateAsks([]);
    setDateAskedViaFollowUp(new Set());
    setStepEffects(emptyStepEffects(placeId));
    setStepAnswerLabels([]);
  }

  // "Précédent"/recap "Modifier": drop this step and everything after it — nothing was
  // ever written to the database, so re-answering from here is all that's needed.
  function jumpToStep(index: number) {
    const truncated = history.slice(0, index);
    const question = history[index].question;
    setHistory(truncated);
    setCurrentQuestion(question);
    setSelected(history[index].answerLabels);
    resetStepState();
  }

  function handleBack() {
    if (history.length === 0) return;
    jumpToStep(history.length - 1);
  }

  if (!currentQuestion) {
    return (
      <RecapCard
        history={history}
        confirming={confirming}
        onBack={handleBack}
        onEditStep={jumpToStep}
        onConfirm={async () => {
          setConfirming(true);
          const merged = history.reduce<QuestionnaireStepEffects>((acc, step) => {
            acc.createEquipmentTypeIds.push(...step.effects.createEquipmentTypeIds);
            acc.dateAnswers.push(...step.effects.dateAnswers);
            acc.unknownChecks.push(...step.effects.unknownChecks);
            if (step.effects.setPropertyType) acc.setPropertyType = step.effects.setPropertyType;
            return acc;
          }, emptyStepEffects(placeId));
          await submitQuestionnaireStep(merged);
          await completeQuestionnaire(placeId);
        }}
      />
    );
  }

  function completeCurrentStep(finalEffects: QuestionnaireStepEffects, answerLabels: string[]) {
    const newHistory = [...history, { question: currentQuestion!, answerLabels, effects: finalEffects }];
    setHistory(newHistory);
    const merged = mergedAnswers(newHistory);
    const next = nextQuestion(merged, currentQuestion!.order, propertyTypeAlreadyKnown);
    setCurrentQuestion(next);
    // A checklist shows what's already there as a starting point (never auto-removed
    // if unchecked: confirming only ever finds-or-creates the boxes left checked).
    const updatedIds = placeEquipmentTypeIds(newHistory);
    setSelected(
      next?.answerType === "checklist"
        ? next.answers.filter((a) => a.creates.some((id) => updatedIds.has(id))).map((a) => a.label)
        : []
    );
    resetStepState();
  }

  function computeDateAsks(equipmentTypeIds: string[], alreadyTargeted: Set<string>): PendingDateAsk[] {
    const inPlace = placeEquipmentTypeIds();
    const raw: { equipmentTypeId: string; taskId: string }[] = [];
    for (const typeId of equipmentTypeIds) {
      if (inPlace.has(typeId) || alreadyTargeted.has(typeId)) continue;
      for (const task of getTrackedLegalTasks(typeId)) {
        if (task.frequency.months >= 12) {
          raw.push({ equipmentTypeId: typeId, taskId: task.id });
        }
      }
    }
    const hearth = raw.filter((a) => HEARTH_TYPE_IDS.has(a.equipmentTypeId));
    const conduit = raw.filter((a) => a.equipmentTypeId === "CH-07");
    if (hearth.length === 1 && conduit.length === 1) {
      const combined: PendingDateAsk = {
        kind: "combined",
        applianceTypeId: hearth[0].equipmentTypeId,
        applianceTaskId: hearth[0].taskId,
        conduitTypeId: conduit[0].equipmentTypeId,
        conduitTaskId: conduit[0].taskId,
      };
      const others = raw
        .filter((a) => a !== hearth[0] && a !== conduit[0])
        .map((a) => ({ kind: "single" as const, ...a }));
      return [combined, ...others];
    }
    return raw.map((a) => ({ kind: "single" as const, ...a }));
  }

  function proceedAfterFollowUps(
    effects: QuestionnaireStepEffects,
    answerLabels: string[],
    askedViaFollowUp: Set<string> = dateAskedViaFollowUp
  ) {
    const alreadyTargeted = new Set([
      ...effects.dateAnswers.map((d) => d.equipmentTypeId),
      ...askedViaFollowUp,
    ]);
    const asks = computeDateAsks(effects.createEquipmentTypeIds, alreadyTargeted);
    if (asks.length > 0) {
      setStepEffects(effects);
      setStepAnswerLabels(answerLabels);
      setPendingDateAsks(asks);
    } else {
      completeCurrentStep(effects, answerLabels);
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
    if (followUps.length > 0) {
      setStepEffects(effects);
      setStepAnswerLabels(answerLabels);
      setPendingFollowUps(followUps);
    } else {
      proceedAfterFollowUps(effects, answerLabels);
    }
  }

  function advanceFollowUp(effects: QuestionnaireStepEffects, updatedAsked: Set<string>) {
    const remaining = pendingFollowUps.slice(1);
    setPendingFollowUps(remaining);
    if (remaining.length > 0) {
      setStepEffects(effects);
    } else {
      proceedAfterFollowUps(effects, stepAnswerLabels, updatedAsked);
    }
  }

  function handleFollowUpYesNo(kind: "yes" | "no" | "unknown") {
    const { question, answer } = pendingFollowUps[0];
    const followUp = answer.followUp!;
    const effects = { ...stepEffects };
    if (kind === "yes") {
      effects.createEquipmentTypeIds = [...effects.createEquipmentTypeIds, ...followUp.createsIfYes];
    } else if (kind === "unknown") {
      effects.unknownChecks = [
        ...effects.unknownChecks,
        { questionId: question.id, questionLabel: followUp.question, help: null },
      ];
    }
    advanceFollowUp(effects, dateAskedViaFollowUp);
  }

  // REGLE-01: the "date du dernier passage" follow-ups (SPANC, controle technique).
  function handleFollowUpServiceDate(result: DateGradeResult) {
    const { question, answer } = pendingFollowUps[0];
    const target = FOLLOW_UP_DATE_TARGETS[`${question.id}|${answer.label}`]!;
    const effects = {
      ...stepEffects,
      dateAnswers: [
        ...stepEffects.dateAnswers,
        { equipmentTypeId: target.equipmentTypeId, taskId: target.taskId, field: "last_service_date" as const, ...result },
      ],
    };
    const updated = new Set([...dateAskedViaFollowUp, target.equipmentTypeId]);
    setDateAskedViaFollowUp(updated);
    advanceFollowUp(effects, updated);
  }

  // A future date (e.g. the gas hose's printed expiry), not a REGLE-01 last-service date.
  function handleFollowUpFutureDate(value: string | null) {
    const { question, answer } = pendingFollowUps[0];
    const target = FOLLOW_UP_DATE_TARGETS[`${question.id}|${answer.label}`]!;
    const effects = { ...stepEffects };
    if (value) {
      effects.dateAnswers = [
        ...effects.dateAnswers,
        { equipmentTypeId: target.equipmentTypeId, taskId: target.taskId, field: target.field, date: value },
      ];
    }
    const updated = new Set([...dateAskedViaFollowUp, target.equipmentTypeId]);
    setDateAskedViaFollowUp(updated);
    advanceFollowUp(effects, updated);
  }

  function handleDateAskAnswer(result: DateGradeResult) {
    const ask = pendingDateAsks[0];
    const dateAnswers = [...stepEffects.dateAnswers];
    if (ask.kind === "single") {
      dateAnswers.push({ equipmentTypeId: ask.equipmentTypeId, taskId: ask.taskId, field: "last_service_date", ...result });
    } else {
      // REGLE-03: same passage services both, unless "faits separement ?" was used.
      dateAnswers.push({ equipmentTypeId: ask.applianceTypeId, taskId: ask.applianceTaskId, field: "last_service_date", ...result });
      dateAnswers.push({ equipmentTypeId: ask.conduitTypeId, taskId: ask.conduitTaskId, field: "last_service_date", ...result });
    }
    const effects = { ...stepEffects, dateAnswers };
    const remaining = pendingDateAsks.slice(1);
    setPendingDateAsks(remaining);
    if (remaining.length > 0) {
      setStepEffects(effects);
    } else {
      completeCurrentStep(effects, stepAnswerLabels);
    }
  }

  function handleDateAskSeparate() {
    const ask = pendingDateAsks[0];
    if (ask.kind !== "combined") return;
    setPendingDateAsks([
      { kind: "single", equipmentTypeId: ask.applianceTypeId, taskId: ask.applianceTaskId },
      { kind: "single", equipmentTypeId: ask.conduitTypeId, taskId: ask.conduitTaskId },
      ...pendingDateAsks.slice(1),
    ]);
  }

  if (pendingDateAsks.length > 0) {
    const ask = pendingDateAsks[0];
    if (ask.kind === "combined") {
      return (
        <ServiceDateGradeCard
          title={`${applianceLabel(ask.applianceTypeId)} et son conduit de fumée : date du dernier entretien et ramonage ?`}
          onAnswer={handleDateAskAnswer}
          onBack={handleBack}
          extraLink={{ label: "Faits séparément ?", onClick: handleDateAskSeparate }}
        />
      );
    }
    return (
      <ServiceDateGradeCard
        title={`${applianceLabel(ask.equipmentTypeId)} : date du dernier passage (entretien, ramonage, contrôle ou vidange) ?`}
        onAnswer={handleDateAskAnswer}
        onBack={handleBack}
      />
    );
  }

  if (pendingFollowUps.length > 0) {
    const { question, answer } = pendingFollowUps[0];
    const target = FOLLOW_UP_DATE_TARGETS[`${question.id}|${answer.label}`];
    const subjectTypeId = target?.equipmentTypeId ?? answer.creates[0];
    const subjectLabel = getQuestionnaireApplianceLabel(subjectTypeId);
    const questionText = answer.followUp!.question;
    const title = subjectLabel ? `${subjectLabel} : ${questionText}` : questionText;

    if (target) {
      if (target.field === "known_due_date") {
        return (
          <DateAskCard
            title={title}
            dateType="date"
            future
            onAnswer={handleFollowUpFutureDate}
            onBack={handleBack}
          />
        );
      }
      return <ServiceDateGradeCard title={title} onAnswer={handleFollowUpServiceDate} onBack={handleBack} />;
    }
    return <YesNoCard question={title} onAnswer={handleFollowUpYesNo} onBack={handleBack} />;
  }

  if (currentQuestion.answerType === "automatic") {
    return (
      <div className={CARD_CLASS}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">…</p>
      </div>
    );
  }

  const questionText = resolveResidenceText(currentQuestion.question, effectivePropertyType(history));

  return (
    <div className={CARD_CLASS}>
      {history.length > 0 && <BackLink onClick={handleBack} />}
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {currentQuestion.block === "maintenance" ? "Entretien (facultatif)" : "Question"}
      </p>
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{questionText}</h2>
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
        disabled={currentQuestion.answerType !== "checklist" && selected.length === 0}
        onClick={() => handleMainSubmit()}
      >
        Suivant
      </button>
    </div>
  );
}

function YesNoCard({
  question,
  onAnswer,
  onBack,
}: {
  question: string;
  onAnswer: (kind: "yes" | "no" | "unknown") => void;
  onBack: () => void;
}) {
  return (
    <div className={CARD_CLASS}>
      <BackLink onClick={onBack} />
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{question}</h2>
      <div className="flex flex-wrap gap-2">
        <button className={BUTTON_CLASS} onClick={() => onAnswer("yes")}>
          Oui
        </button>
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer("no")}>
          Non
        </button>
      </div>
      <button className={DISCREET_LINK_CLASS} onClick={() => onAnswer("unknown")}>
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
  onBack,
}: {
  title: string;
  dateType?: "month" | "date";
  future?: boolean;
  onAnswer: (value: string | null) => void;
  onBack: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className={CARD_CLASS}>
      <BackLink onClick={onBack} />
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
          disabled={!value}
          onClick={() => onAnswer(dateType === "month" ? `${value}-01` : value)}
        >
          Valider
        </button>
      </div>
      <button className={DISCREET_LINK_CLASS} onClick={() => onAnswer(null)}>
        Je ne sais pas
      </button>
    </div>
  );
}

// REGLE-01: date precise -> calcul normal ; fait recemment sans date exacte -> a
// confirmer (orange) ; plus ancien que le delai legal -> en retard (rouge) ; jamais
// realise ou je ne sais pas -> en retard (rouge), prioritaire. Dates saisies en
// chiffres (MM/AAAA).
function ServiceDateGradeCard({
  title,
  onAnswer,
  onBack,
  extraLink,
}: {
  title: string;
  onAnswer: (result: DateGradeResult) => void;
  onBack: () => void;
  extraLink?: { label: string; onClick: () => void };
}) {
  const [value, setValue] = useState("");
  const today = new Date().toISOString().slice(0, 7);
  return (
    <div className={CARD_CLASS}>
      <BackLink onClick={onBack} />
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{title}</h2>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          max={today}
          placeholder="MM/AAAA"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button className={BUTTON_CLASS} disabled={!value} onClick={() => onAnswer({ date: `${value}-01` })}>
          Valider
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "recent" })}>
          Fait récemment, date exacte inconnue
        </button>
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "old" })}>
          Fait, mais il y a plus longtemps que le délai
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button className={DISCREET_LINK_CLASS} onClick={() => onAnswer({ confidence: "never" })}>
          Jamais fait ou je ne sais pas
        </button>
        {extraLink && (
          <button className={DISCREET_LINK_CLASS} onClick={extraLink.onClick}>
            {extraLink.label}
          </button>
        )}
      </div>
    </div>
  );
}

// Nothing is created until this screen's single confirmation (spec's "Back button and
// recap"). Every line traces back to the question that produced it, via "Modifier".
function RecapCard({
  history,
  confirming,
  onBack,
  onEditStep,
  onConfirm,
}: {
  history: AnsweredStep[];
  confirming: boolean;
  onBack: () => void;
  onEditStep: (index: number) => void;
  onConfirm: () => void;
}) {
  type RecapLine = { key: string; stepIndex: number; text: string; sub?: string };
  const lines: RecapLine[] = [];
  history.forEach((step, stepIndex) => {
    if (step.effects.setPropertyType) {
      lines.push({
        key: `${stepIndex}-property`,
        stepIndex,
        text: `Type de logement : ${PROPERTY_TYPE_LABELS[step.effects.setPropertyType]}`,
      });
    }
    const dateByType = new Map(step.effects.dateAnswers.map((d) => [d.equipmentTypeId, d]));
    for (const typeId of step.effects.createEquipmentTypeIds) {
      const dateAnswer = dateByType.get(typeId);
      lines.push({
        key: `${stepIndex}-${typeId}`,
        stepIndex,
        text: applianceLabel(typeId),
        sub: dateAnswer ? describeDateAnswer(dateAnswer) : undefined,
      });
    }
    for (const d of step.effects.dateAnswers) {
      if (step.effects.createEquipmentTypeIds.includes(d.equipmentTypeId)) continue;
      lines.push({
        key: `${stepIndex}-date-${d.equipmentTypeId}-${d.taskId}`,
        stepIndex,
        text: applianceLabel(d.equipmentTypeId),
        sub: describeDateAnswer(d),
      });
    }
    for (const check of step.effects.unknownChecks) {
      lines.push({ key: `${stepIndex}-check-${check.questionId}`, stepIndex, text: `À vérifier : ${check.questionLabel}` });
    }
  });

  return (
    <div className={CARD_CLASS}>
      {history.length > 0 && <BackLink onClick={onBack} />}
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Récapitulatif</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Rien n&apos;a encore été créé. Vérifiez ce qui va être ajouté à ce lieu, puis confirmez.
      </p>

      {lines.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Rien à créer pour ce lieu.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <li
              key={line.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{line.text}</span>
                {line.sub && <span className="ml-2 text-zinc-500 dark:text-zinc-400">({line.sub})</span>}
              </span>
              <button
                className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                onClick={() => onEditStep(line.stepIndex)}
              >
                Modifier
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className={BUTTON_CLASS} disabled={confirming} onClick={onConfirm}>
        {confirming ? "…" : "Confirmer et créer"}
      </button>
    </div>
  );
}
