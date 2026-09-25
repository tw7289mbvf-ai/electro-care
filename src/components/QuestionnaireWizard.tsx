"use client";

import { useEffect, useState } from "react";
import { QUESTIONS, type QuestionnaireAnswer, type QuestionnaireQuestion } from "@/lib/questionnaire";
import {
  getApplianceLabelForEquipmentType,
  getCombinedDateQuestion,
  getDateQuestionForTask,
  type DateQuestion,
} from "@/lib/date-questions";
import { getEquipmentType } from "@/lib/equipment-types";
import { getTrackedLegalTasks, getMaintenanceTask } from "@/lib/maintenance-tasks";
import { formatFrenchMonthYear, pastYearOptions, wideYearOptions } from "@/lib/french-dates";
import { MonthYearFields, monthYearToIso } from "@/components/MonthYearFields";
import { submitQuestionnaireStep, completeQuestionnaire } from "@/app/actions";
import type { QuestionnaireStepEffects } from "@/lib/questionnaire-effects";
import { PROPERTY_TYPE_LABELS, type PropertyType } from "@/lib/place-types";

type PendingFollowUp = { question: QuestionnaireQuestion; answer: QuestionnaireAnswer };
// REGLE-03: a hearth appliance (poele, insert, chaudiere) created alongside its flue
// (CH-07) in the same step is asked as one combined date question, not two.
type PendingDateAsk =
  | { kind: "single"; taskId: string; equipmentTypeId: string; dq: DateQuestion }
  | { kind: "combined"; taskIds: [string, string]; dq: DateQuestion };
// A date question's answer: a precise date (last_service_date), a fixed due date
// (known_due_date — an expiry, or a vehicle's registration + threshold), or (REGLE-01)
// a graded answer with no exact date.
type DateAnswerResult = { date: string } | { dueDate: string } | { confidence: "recent" | "old" | "never" | "compliant" };

// Nothing is written to the database until the final recap confirmation (see spec's
// "Back button and recap"). Each fully-answered question becomes one entry here; "Précédent"
// simply drops the tail of this list and re-asks from there — nothing was ever persisted,
// so there is no stray appliance to clean up.
type AnsweredStep = {
  question: QuestionnaireQuestion;
  answerLabels: string[];
  effects: QuestionnaireStepEffects;
};

const Q01 = QUESTIONS.find((q) => q.id === "Q01")!;

// The "jamais, elle/il a moins de N ans" branch (vehicle_inspection): wording and
// threshold are seed-authored (seed/date_questions.json's note field), copied here
// since the seed has no structured field for either.
const VEHICLE_YOUNG_OPTION: Record<string, { label: string; years: number }> = {
  "T-152": { label: "Jamais, elle a moins de 4 ans", years: 4 },
  "T-153": { label: "Jamais, il a moins de 5 ans", years: 5 },
};

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
  return getApplianceLabelForEquipmentType(equipmentTypeId) ?? getEquipmentType(equipmentTypeId)?.label ?? equipmentTypeId;
}

function toDateAnswer(
  equipmentTypeId: string,
  taskId: string,
  result: DateAnswerResult
): QuestionnaireStepEffects["dateAnswers"][number] {
  if ("date" in result) return { equipmentTypeId, taskId, field: "last_service_date", date: result.date };
  if ("dueDate" in result) return { equipmentTypeId, taskId, field: "known_due_date", date: result.dueDate };
  return { equipmentTypeId, taskId, field: "last_service_date", confidence: result.confidence };
}

function describeDateAnswer(d: QuestionnaireStepEffects["dateAnswers"][number]): string {
  if (d.field === "known_due_date") {
    return d.date ? `échéance : ${formatFrenchMonthYear(d.date)}` : "échéance inconnue";
  }
  if (d.date) return `dernier passage : ${formatFrenchMonthYear(d.date)}`;
  const kind = getDateQuestionForTask(d.taskId)?.kind;
  if (d.confidence === "compliant") return "conforme";
  if (d.confidence === "old") return kind === "yes_no" ? "non déclaré" : "fait, il y a plus longtemps que le délai";
  if (d.confidence === "recent") return kind === "yes_no" ? "à confirmer" : "date à préciser plus tard";
  return "jamais fait ou inconnu";
}

function addYearsIso(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split("-");
  return `${Number(y) + years}-${m}-${d}`;
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
const BACK_LINK_CLASS = "self-start text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400";

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
  const [confirming, setConfirming] = useState(false);

  // Accumulated across the main question and any follow-ups it triggers, folded into
  // `history` as one step once every sub-phase for this question is resolved.
  const [stepEffects, setStepEffects] = useState<QuestionnaireStepEffects>(emptyStepEffects(placeId));
  const [stepAnswerLabels, setStepAnswerLabels] = useState<string[]>([]);

  function placeEquipmentTypeIds(atHistory: AnsweredStep[] = history): Set<string> {
    return new Set([...existingEquipmentTypeIds, ...atHistory.flatMap((s) => s.effects.createEquipmentTypeIds)]);
  }

  // "automatic" questions have nothing to ask: the single answer always applies,
  // submitted as soon as this question is reached. Every hook must run
  // unconditionally, so this sits above the early returns below.
  useEffect(() => {
    if (currentQuestion?.answerType === "automatic" && pendingFollowUps.length === 0 && pendingDateAsks.length === 0) {
      handleMainSubmit([currentQuestion.answers[0].label]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion]);

  function resetStepState() {
    setPendingFollowUps([]);
    setPendingDateAsks([]);
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

  // REGLE-03: two pending tasks with a combo entry in date_questions.json are asked as
  // one combined question. REGLE-06: a task already fixed by initial_status
  // (excludeTaskIds) isn't asked at all. A task whose kind is "none" needs no question
  // either (its obligation defaults to compliant at creation — see questionnaire-effects.ts).
  function computeDateAsks(equipmentTypeIds: string[], excludeTaskIds: Set<string>): PendingDateAsk[] {
    const inPlace = placeEquipmentTypeIds();
    const pending: { taskId: string; equipmentTypeId: string }[] = [];
    for (const typeId of equipmentTypeIds) {
      if (inPlace.has(typeId)) continue;
      for (const task of getTrackedLegalTasks(typeId)) {
        if (excludeTaskIds.has(task.id)) continue;
        const dq = getDateQuestionForTask(task.id);
        if (!dq || dq.kind === "none") continue;
        pending.push({ taskId: task.id, equipmentTypeId: typeId });
      }
    }
    const asks: PendingDateAsk[] = [];
    const consumed = new Set<string>();
    for (const p of pending) {
      if (consumed.has(p.taskId)) continue;
      const partner = pending.find(
        (o) => !consumed.has(o.taskId) && o.taskId !== p.taskId && getCombinedDateQuestion(p.taskId, o.taskId)
      );
      if (partner) {
        consumed.add(p.taskId);
        consumed.add(partner.taskId);
        asks.push({ kind: "combined", taskIds: [p.taskId, partner.taskId], dq: getCombinedDateQuestion(p.taskId, partner.taskId)! });
      } else {
        consumed.add(p.taskId);
        asks.push({ kind: "single", taskId: p.taskId, equipmentTypeId: p.equipmentTypeId, dq: getDateQuestionForTask(p.taskId)! });
      }
    }
    return asks;
  }

  function proceedAfterFollowUps(effects: QuestionnaireStepEffects, answerLabels: string[]) {
    const excludeTaskIds = new Set(effects.dateAnswers.map((d) => d.taskId));
    const asks = computeDateAsks(effects.createEquipmentTypeIds, excludeTaskIds);
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
    // REGLE-06: a "Statut initial" fixes the confidence directly; its date question is
    // never asked (proceedAfterFollowUps excludes it via effects.dateAnswers below).
    for (const answer of chosenAnswers) {
      for (const [taskId, confidence] of Object.entries(answer.initialStatus ?? {})) {
        const equipmentTypeId = getMaintenanceTask(taskId)?.equipmentTypeId;
        if (!equipmentTypeId) continue;
        effects.dateAnswers.push({ equipmentTypeId, taskId, field: "last_service_date", confidence });
      }
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

  function advanceFollowUp(effects: QuestionnaireStepEffects) {
    const remaining = pendingFollowUps.slice(1);
    setPendingFollowUps(remaining);
    if (remaining.length > 0) {
      setStepEffects(effects);
    } else {
      proceedAfterFollowUps(effects, stepAnswerLabels);
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
    advanceFollowUp(effects);
  }

  function handleDateAskAnswer(result: DateAnswerResult) {
    const ask = pendingDateAsks[0];
    const dateAnswers = [...stepEffects.dateAnswers];
    if (ask.kind === "single") {
      dateAnswers.push(toDateAnswer(ask.equipmentTypeId, ask.taskId, result));
    } else {
      // REGLE-03: same passage services both, unless "faits separement ?" was used.
      for (const taskId of ask.taskIds) {
        const equipmentTypeId = getMaintenanceTask(taskId)!.equipmentTypeId;
        dateAnswers.push(toDateAnswer(equipmentTypeId, taskId, result));
      }
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
    const singles: PendingDateAsk[] = ask.taskIds.map((taskId) => ({
      kind: "single",
      taskId,
      equipmentTypeId: getMaintenanceTask(taskId)!.equipmentTypeId,
      dq: getDateQuestionForTask(taskId)!,
    }));
    setPendingDateAsks([...singles, ...pendingDateAsks.slice(1)]);
  }

  if (pendingDateAsks.length > 0) {
    const ask = pendingDateAsks[0];
    if (ask.kind === "combined") {
      return (
        <GradedMonthCard
          dq={ask.dq}
          onAnswer={handleDateAskAnswer}
          onBack={handleBack}
          extraLink={{ label: "Faits séparément ?", onClick: handleDateAskSeparate }}
        />
      );
    }
    switch (ask.dq.kind) {
      case "expiry_date":
        return (
          <SimpleDateOrUnknownCard
            title={ask.dq.question!}
            resultKind="dueDate"
            unknownLabel="Je ne trouve pas la date"
            futureYears
            onAnswer={handleDateAskAnswer}
            onBack={handleBack}
          />
        );
      case "manufacture_date":
        return (
          <SimpleDateOrUnknownCard
            title={ask.dq.question!}
            resultKind="date"
            unknownLabel="Je ne la trouve pas"
            onAnswer={handleDateAskAnswer}
            onBack={handleBack}
          />
        );
      case "vehicle_inspection":
        return <VehicleInspectionCard dq={ask.dq} taskId={ask.taskId} onAnswer={handleDateAskAnswer} onBack={handleBack} />;
      case "yes_no":
        return <YesNoStatusCard title={ask.dq.question!} onAnswer={handleDateAskAnswer} onBack={handleBack} />;
      default:
        return <GradedMonthCard dq={ask.dq} onAnswer={handleDateAskAnswer} onBack={handleBack} />;
    }
  }

  if (pendingFollowUps.length > 0) {
    const { answer } = pendingFollowUps[0];
    const subjectLabel = getApplianceLabelForEquipmentType(answer.creates[0]);
    const questionText = answer.followUp!.question;
    const title = subjectLabel ? `${subjectLabel} : ${questionText}` : questionText;
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

// yes_no kind (e.g. T-137, le puits declare en mairie): Oui -> conforme (vert), Non ->
// en retard (rouge), Je ne sais pas -> a confirmer (orange).
function YesNoStatusCard({
  title,
  onAnswer,
  onBack,
}: {
  title: string;
  onAnswer: (result: DateAnswerResult) => void;
  onBack: () => void;
}) {
  return (
    <div className={CARD_CLASS}>
      <BackLink onClick={onBack} />
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="flex flex-wrap gap-2">
        <button className={BUTTON_CLASS} onClick={() => onAnswer({ confidence: "compliant" })}>
          Oui
        </button>
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "old" })}>
          Non
        </button>
      </div>
      <button className={DISCREET_LINK_CLASS} onClick={() => onAnswer({ confidence: "recent" })}>
        Je ne sais pas
      </button>
    </div>
  );
}

// REGLE-01: date precise -> calcul normal ; « Il y a moins de {delai} », sans date
// exacte -> a confirmer (orange) ; « Il y a plus de {delai} » -> en retard (rouge) ;
// « Jamais » ou « Je ne sais pas » -> en retard, prioritaire.
function GradedMonthCard({
  dq,
  onAnswer,
  onBack,
  extraLink,
}: {
  dq: DateQuestion;
  onAnswer: (result: DateAnswerResult) => void;
  onBack: () => void;
  extraLink?: { label: string; onClick: () => void };
}) {
  const [value, setValue] = useState({ month: "", year: "" });
  const iso = monthYearToIso(value);
  return (
    <div className={CARD_CLASS}>
      <BackLink onClick={onBack} />
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{dq.question}</h2>

      <div className="flex flex-wrap items-center gap-2">
        <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} />
        <button className={BUTTON_CLASS} disabled={!iso} onClick={() => onAnswer({ date: iso! })}>
          Valider
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "recent" })}>
          Il y a moins de {dq.intervalLabel}
        </button>
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "old" })}>
          Il y a plus de {dq.intervalLabel}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button className={DISCREET_LINK_CLASS} onClick={() => onAnswer({ confidence: "never" })}>
          Jamais
        </button>
        <button className={DISCREET_LINK_CLASS} onClick={() => onAnswer({ confidence: "never" })}>
          Je ne sais pas
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

// expiry_date (T-060, le tuyau de gaz) : la date donnee devient l'echeance.
// manufacture_date (T-083, le detecteur) : l'echeance = date + intervalLabel, calculee
// comme un passage normal (meme mecanisme que graded_month).
function SimpleDateOrUnknownCard({
  title,
  resultKind,
  unknownLabel,
  futureYears = false,
  onAnswer,
  onBack,
}: {
  title: string;
  resultKind: "date" | "dueDate";
  unknownLabel: string;
  futureYears?: boolean;
  onAnswer: (result: DateAnswerResult) => void;
  onBack: () => void;
}) {
  const [value, setValue] = useState({ month: "", year: "" });
  const iso = monthYearToIso(value);
  return (
    <div className={CARD_CLASS}>
      <BackLink onClick={onBack} />
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <MonthYearFields value={value} onChange={setValue} years={futureYears ? wideYearOptions() : pastYearOptions()} />
        <button
          className={BUTTON_CLASS}
          disabled={!iso}
          onClick={() => onAnswer(resultKind === "dueDate" ? { dueDate: iso! } : { date: iso! })}
        >
          Valider
        </button>
      </div>
      <button className={DISCREET_LINK_CLASS} onClick={() => onAnswer({ confidence: "recent" })}>
        {unknownLabel}
      </button>
    </div>
  );
}

// vehicle_inspection (T-152, T-153) : comme graded_month, plus une option « Jamais,
// elle/il a moins de N ans » qui demande la date de premiere immatriculation ; echeance
// = cette date + N ans.
function VehicleInspectionCard({
  dq,
  taskId,
  onAnswer,
  onBack,
}: {
  dq: DateQuestion;
  taskId: string;
  onAnswer: (result: DateAnswerResult) => void;
  onBack: () => void;
}) {
  const [value, setValue] = useState({ month: "", year: "" });
  const [showYoung, setShowYoung] = useState(false);
  const [regValue, setRegValue] = useState({ month: "", year: "" });
  const young = VEHICLE_YOUNG_OPTION[taskId];
  const iso = monthYearToIso(value);
  const regIso = monthYearToIso(regValue);

  if (showYoung) {
    return (
      <div className={CARD_CLASS}>
        <BackLink onClick={() => setShowYoung(false)} />
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Date de première immatriculation ?</h2>
        <div className="flex flex-wrap items-center gap-2">
          <MonthYearFields value={regValue} onChange={setRegValue} years={pastYearOptions()} />
          <button
            className={BUTTON_CLASS}
            disabled={!regIso}
            onClick={() => onAnswer({ dueDate: addYearsIso(regIso!, young.years) })}
          >
            Valider
          </button>
        </div>
        <button className={DISCREET_LINK_CLASS} onClick={() => onAnswer({ confidence: "recent" })}>
          Je ne sais pas
        </button>
      </div>
    );
  }

  return (
    <div className={CARD_CLASS}>
      <BackLink onClick={onBack} />
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{dq.question}</h2>

      <div className="flex flex-wrap items-center gap-2">
        <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} />
        <button className={BUTTON_CLASS} disabled={!iso} onClick={() => onAnswer({ date: iso! })}>
          Valider
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "recent" })}>
          Il y a moins de {dq.intervalLabel}
        </button>
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "old" })}>
          Il y a plus de {dq.intervalLabel}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {young && (
          <button className={DISCREET_LINK_CLASS} onClick={() => setShowYoung(true)}>
            {young.label}
          </button>
        )}
        <button className={DISCREET_LINK_CLASS} onClick={() => onAnswer({ confidence: "never" })}>
          Jamais
        </button>
        <button className={DISCREET_LINK_CLASS} onClick={() => onAnswer({ confidence: "never" })}>
          Je ne sais pas
        </button>
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
    const dateAnswersByType = new Map<string, QuestionnaireStepEffects["dateAnswers"]>();
    for (const d of step.effects.dateAnswers) {
      dateAnswersByType.set(d.equipmentTypeId, [...(dateAnswersByType.get(d.equipmentTypeId) ?? []), d]);
    }
    const coveredTypes = new Set<string>();
    for (const typeId of step.effects.createEquipmentTypeIds) {
      if (coveredTypes.has(typeId)) continue;
      coveredTypes.add(typeId);
      const dAnswers = dateAnswersByType.get(typeId) ?? [];
      lines.push({
        key: `${stepIndex}-${typeId}`,
        stepIndex,
        text: applianceLabel(typeId),
        sub: dAnswers.length > 0 ? dAnswers.map(describeDateAnswer).join(" · ") : undefined,
      });
    }
    for (const [typeId, dAnswers] of dateAnswersByType) {
      if (coveredTypes.has(typeId)) continue;
      lines.push({
        key: `${stepIndex}-date-${typeId}`,
        stepIndex,
        text: applianceLabel(typeId),
        sub: dAnswers.map(describeDateAnswer).join(" · "),
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
