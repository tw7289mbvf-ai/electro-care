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
import {
  MAINTENANCE_LEVEL_LABELS,
  estimateMaintenanceMinutesForAllLevels,
  type MaintenanceLevel,
} from "@/lib/maintenance-levels";
import { MaintenanceLevelOptions } from "@/components/MaintenanceLevelOptions";
import { InvoiceImportFlow } from "@/components/InvoiceImportFlow";
import { EQUIPMENT_TYPES } from "@/lib/equipment-types";
import type { InvoiceImportMode } from "@/lib/invoice-extraction";
import { VEHICLE_YOUNG_OPTION, addYearsIso, type DateAnswerResult } from "@/lib/date-answer";
import { Icon } from "@/components/ui";

type PendingFollowUp = { question: QuestionnaireQuestion; answer: QuestionnaireAnswer };
// REGLE-03: a hearth appliance (poele, insert, chaudiere) created alongside its flue
// (CH-07) in the same step is asked as one combined date question, not two.
type PendingDateAsk =
  | { kind: "single"; taskId: string; equipmentTypeId: string; dq: DateQuestion }
  | { kind: "combined"; taskIds: [string, string]; dq: DateQuestion };

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

// Not a seed-driven question (level doesn't create an appliance or fix a date): a
// synthetic step inserted right after Q20 (the appliance checklist), matching the
// spec's "then the level, once the appliances are known" — the time estimate it shows
// needs every appliance the place has, including the ones just checked in Q20. Its
// order only needs to sit after Q20 (the last seed-driven question).
const LEVEL_QUESTION: QuestionnaireQuestion = {
  id: "LEVEL",
  block: "maintenance",
  order: 20.5,
  question: "Quel suivi voulez-vous pour l'entretien de vos appareils ?",
  answerType: "single",
  skipIf: null,
  answers: [],
};

// Only these two are offered here: Aucun is already handled by Q19 ("Non, plus tard"),
// which never reaches this step at all.
const QUESTIONNAIRE_LEVEL_CHOICES: readonly MaintenanceLevel[] = ["essential", "recommended"];

// Synthetic step inserted right before Q20 (spec: "in the questionnaire, just before
// the appliance checklist"). Order only needs to sit before Q20 (order 20) and after
// Q19 (order 19).
const IMPORT_QUESTION: QuestionnaireQuestion = {
  id: "IMPORT",
  block: "context",
  order: 19.5,
  question: "Importer une facture",
  answerType: "single",
  skipIf: null,
  answers: [],
};

const IMPORT_FLOW_EQUIPMENT_TYPES = EQUIPMENT_TYPES.map((t) => ({ id: t.id, category: t.category, label: t.label }));

// Inserted once, right before Q20 is reached — never again once an IMPORT entry sits
// in history (e.g. reached again via "Précédent" from the recap). The "Non, plus tard"
// branch of Q19 skips Q20 entirely via skip_if, so nextQuestion never returns "Q20"
// there and this gate is a no-op on that path.
function withImportGate(
  next: QuestionnaireQuestion | null,
  historyForCheck: AnsweredStep[]
): QuestionnaireQuestion | null {
  if (next?.id === "Q20" && !historyForCheck.some((s) => s.question.id === "IMPORT")) {
    return IMPORT_QUESTION;
  }
  return next;
}

const LEVEL_LABEL_TO_KEY: Record<string, MaintenanceLevel> = Object.fromEntries(
  Object.entries(MAINTENANCE_LEVEL_LABELS).map(([key, label]) => [label, key as MaintenanceLevel])
);

// The level step is inserted once, right after Q20 is answered — only when Q20 was
// actually asked (the "Oui, je les ajoute" branch): the "Non, plus tard" branch skips
// Q20 via skip_if and must reach the recap directly, per Q19's own `sets`. Skipped on
// any later pass once a LEVEL entry already sits in history (e.g. reached again via
// "Précédent" from the recap).
function withLevelGate(
  next: QuestionnaireQuestion | null,
  historyForCheck: AnsweredStep[]
): QuestionnaireQuestion | null {
  if (
    next === null &&
    historyForCheck.some((s) => s.question.id === "Q20") &&
    !historyForCheck.some((s) => s.question.id === "LEVEL")
  ) {
    return LEVEL_QUESTION;
  }
  return next;
}

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
  if (d.confidence === "old") {
    if (kind !== "yes_no") return "fait, il y a plus longtemps que le délai";
    return d.taskId === "T-137" ? "non déclaré" : "non";
  }
  if (d.confidence === "recent") return kind === "yes_no" ? "à confirmer" : "date à préciser plus tard";
  return "jamais fait ou inconnu";
}

const CARD_CLASS =
  "flex flex-col gap-4 rounded-[20px] bg-surface p-5 sm:p-6";
const OPTION_CLASS =
  "flex items-start gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:border-accent cursor-pointer";
const BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 font-semibold text-on-accent transition-colors hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60";
const GHOST_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-xl border-[1.5px] border-line-strong px-4 py-2 font-medium text-ink hover:bg-surface-2";
const DISCREET_LINK_CLASS = "inline-flex min-h-11 items-center self-start text-sm text-ink-2 hover:underline";
const BACK_LINK_CLASS = "-ml-1 inline-flex min-h-11 items-center gap-1 self-start text-[15px] font-semibold text-accent";

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={BACK_LINK_CLASS} onClick={onClick}>
      <Icon name="back" size={20} strokeWidth={2} />
      Précédent
    </button>
  );
}

export function QuestionnaireWizard({
  placeId,
  existingEquipmentTypeIds,
  existingPropertyType,
  existingMaintenanceLevel,
  invoiceImportMode,
}: {
  placeId: string;
  existingEquipmentTypeIds: string[];
  existingPropertyType: PropertyType | null;
  existingMaintenanceLevel: MaintenanceLevel;
  invoiceImportMode: InvoiceImportMode;
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
    withLevelGate(withImportGate(nextQuestion(mergedAnswers([]), 0, propertyTypeAlreadyKnown), []), [])
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
            if (step.effects.maintenanceLevel) acc.maintenanceLevel = step.effects.maintenanceLevel;
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
    const next = withLevelGate(
      withImportGate(nextQuestion(merged, currentQuestion!.order, propertyTypeAlreadyKnown), newHistory),
      newHistory
    );
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
        // "monitored" (T-157) needs no question either: it's green from the start.
        if (!dq || dq.kind === "none" || dq.kind === "monitored") continue;
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
    const sets = chosenAnswers[0]?.sets;
    if (sets?.property_type) effects.setPropertyType = sets.property_type as QuestionnaireStepEffects["setPropertyType"];
    // Q19 "Non, plus tard" sets the place to Aucun. Without this the column default
    // (essential) stayed, and the place page never offered to resume upkeep.
    if (sets?.maintenance_level) effects.maintenanceLevel = sets.maintenance_level as MaintenanceLevel;
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
    } else {
      // "Je ne sais pas" takes the "Non" branch too: e.g. a detector linked to an alarm
      // not known to be monitored is followed as unmonitored (monthly test), the safe side.
      effects.createEquipmentTypeIds = [...effects.createEquipmentTypeIds, ...followUp.createsIfNo];
    }
    if (kind === "unknown") {
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
        return <ManufactureOrExpiryCard dq={ask.dq} onAnswer={handleDateAskAnswer} onBack={handleBack} />;
      case "vehicle_inspection":
        return <VehicleInspectionCard dq={ask.dq} taskId={ask.taskId} onAnswer={handleDateAskAnswer} onBack={handleBack} />;
      case "yes_no":
        return (
          <YesNoStatusCard title={ask.dq.question!} tip={ask.dq.tip} onAnswer={handleDateAskAnswer} onBack={handleBack} />
        );
      default:
        return <GradedMonthCard dq={ask.dq} onAnswer={handleDateAskAnswer} onBack={handleBack} />;
    }
  }

  if (pendingFollowUps.length > 0) {
    const { answer } = pendingFollowUps[0];
    const subjectLabel = getApplianceLabelForEquipmentType(answer.creates[0] ?? answer.followUp!.createsIfYes[0]);
    const questionText = answer.followUp!.question;
    const title = subjectLabel ? `${subjectLabel} : ${questionText}` : questionText;
    return <YesNoCard question={title} onAnswer={handleFollowUpYesNo} onBack={handleBack} />;
  }

  if (currentQuestion.id === "IMPORT") {
    return (
      <div className="flex flex-col gap-3">
        {history.length > 0 && <BackLink onClick={handleBack} />}
        {invoiceImportMode === "disabled" ? (
          <div className={CARD_CLASS}>
            <p className="text-sm text-ink-2">
              Import de factures : bientôt disponible.
            </p>
            <button className={BUTTON_CLASS} onClick={() => completeCurrentStep(emptyStepEffects(placeId), ["Passer"])}>
              Continuer
            </button>
          </div>
        ) : (
          <InvoiceImportFlow
            placeId={placeId}
            mode={invoiceImportMode}
            equipmentTypes={IMPORT_FLOW_EQUIPMENT_TYPES}
            onImported={({ importedEquipmentTypeIds }) =>
              completeCurrentStep(
                { ...emptyStepEffects(placeId), createEquipmentTypeIds: importedEquipmentTypeIds },
                [`${importedEquipmentTypeIds.length} appareil(s) importé(s)`]
              )
            }
          />
        )}
        {invoiceImportMode !== "disabled" && (
          <button
            className={GHOST_BUTTON_CLASS}
            onClick={() => completeCurrentStep(emptyStepEffects(placeId), ["Passer"])}
          >
            Continuer sans importer
          </button>
        )}
      </div>
    );
  }

  if (currentQuestion.id === "LEVEL") {
    // "Précédent" back to this step must restore the level chosen this session:
    // jumpToStep already put its answer label into `selected` the same way it does for
    // every other step, since by then the step itself has been dropped from `history`.
    const previousChoice = LEVEL_LABEL_TO_KEY[selected[0]];
    // Essentiel by default (spec): existingMaintenanceLevel is "none" the first time
    // through, which isn't one of the two choices offered here.
    const defaultChoice = existingMaintenanceLevel === "none" ? "essential" : existingMaintenanceLevel;
    return (
      <MaintenanceLevelStepCard
        equipmentTypeIds={Array.from(placeEquipmentTypeIds())}
        defaultLevel={previousChoice ?? defaultChoice}
        onBack={handleBack}
        onSubmit={(level) =>
          completeCurrentStep(
            { ...emptyStepEffects(placeId), maintenanceLevel: level },
            [MAINTENANCE_LEVEL_LABELS[level]]
          )
        }
      />
    );
  }

  if (currentQuestion.answerType === "automatic") {
    return (
      <div className={CARD_CLASS}>
        <p className="text-sm text-ink-2">…</p>
      </div>
    );
  }

  const questionText = resolveResidenceText(currentQuestion.question, effectivePropertyType(history));

  return (
    <div className={CARD_CLASS}>
      {history.length > 0 && <BackLink onClick={handleBack} />}
      <p className="text-sm text-ink-2">
        {currentQuestion.block === "maintenance" ? "Entretien (facultatif)" : "Question"}
      </p>
      <h2 className="text-lg font-medium text-ink">{questionText}</h2>
      <div className="flex flex-col gap-2">
        {currentQuestion.answers.map((answer) => {
          const isChecked = selected.includes(answer.label);
          const inputType = currentQuestion.answerType === "single" ? "radio" : "checkbox";
          return (
            <label
              key={answer.label}
              className={`${OPTION_CLASS} ${answer.unknown ? "text-ink-2" : ""}`}
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
                  <span className="mt-0.5 block text-[13px] text-ink-2">{answer.help}</span>
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

function MaintenanceLevelStepCard({
  equipmentTypeIds,
  defaultLevel,
  onBack,
  onSubmit,
}: {
  equipmentTypeIds: string[];
  defaultLevel: MaintenanceLevel;
  onBack: () => void;
  onSubmit: (level: MaintenanceLevel) => void;
}) {
  const [level, setLevel] = useState<MaintenanceLevel>(defaultLevel);
  const estimates = estimateMaintenanceMinutesForAllLevels(equipmentTypeIds);
  return (
    <div className={CARD_CLASS}>
      <BackLink onClick={onBack} />
      <p className="text-sm text-ink-2">Entretien</p>
      <h2 className="text-lg font-medium text-ink">
        Quel suivi voulez-vous pour l&apos;entretien de vos appareils ?
      </h2>
      <MaintenanceLevelOptions
        value={level}
        onChange={setLevel}
        estimates={estimates}
        levels={QUESTIONNAIRE_LEVEL_CHOICES}
      />
      <p className="text-[13px] text-ink-2">
        Vos obligations légales restent suivies dans tous les cas.
      </p>
      <button className={BUTTON_CLASS} onClick={() => onSubmit(level)}>
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
      <h2 className="text-lg font-medium text-ink">{question}</h2>
      <div className="flex flex-wrap gap-2">
        <button className={BUTTON_CLASS} onClick={() => onAnswer("yes")}>
          Oui
        </button>
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer("no")}>
          Non
        </button>
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer("unknown")}>
          Je ne sais pas
        </button>
      </div>
    </div>
  );
}

// yes_no kind (e.g. T-137, le puits declare en mairie): Oui -> conforme (vert), Non ->
// en retard (rouge), Je ne sais pas -> a confirmer (orange).
function YesNoStatusCard({
  title,
  tip,
  onAnswer,
  onBack,
}: {
  title: string;
  tip: string | null;
  onAnswer: (result: DateAnswerResult) => void;
  onBack: () => void;
}) {
  return (
    <div className={CARD_CLASS}>
      <BackLink onClick={onBack} />
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      {tip && <p className="text-sm text-ink-2">{tip}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={BUTTON_CLASS} onClick={() => onAnswer({ confidence: "compliant" })}>
          Oui
        </button>
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "old" })}>
          Non
        </button>
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "recent" })}>
          Je ne sais pas
        </button>
      </div>
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
      <h2 className="text-lg font-medium text-ink">{dq.question}</h2>

      <div className="flex flex-wrap items-center gap-2">
        <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} disableFutureMonths />
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
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "never" })}>
          Jamais ou je ne sais pas
        </button>
      </div>

      {extraLink && (
        <button className={DISCREET_LINK_CLASS} onClick={extraLink.onClick}>
          {extraLink.label}
        </button>
      )}
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
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <MonthYearFields value={value} onChange={setValue} years={futureYears ? wideYearOptions() : pastYearOptions()} disableFutureMonths={!futureYears} />
        <button
          className={BUTTON_CLASS}
          disabled={!iso}
          onClick={() => onAnswer(resultKind === "dueDate" ? { dueDate: iso! } : { date: iso! })}
        >
          Valider
        </button>
      </div>
      <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "recent" })}>
        {unknownLabel}
      </button>
    </div>
  );
}

// manufacture_date (T-083, le detecteur de fumee) : deux dates possibles sont imprimees
// au dos, au choix de l'utilisateur — date de fabrication (echeance = date + 10 ans,
// jamais future) ou date limite de remplacement, imprimee telle quelle (echeance = cette
// date, qui peut etre future, d'ou wideYearOptions ici et non pastYearOptions).
function ManufactureOrExpiryCard({
  dq,
  onAnswer,
  onBack,
}: {
  dq: DateQuestion;
  onAnswer: (result: DateAnswerResult) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"choice" | "manufacture" | "expiry">("choice");

  if (mode === "manufacture") {
    return (
      <SimpleDateOrUnknownCard
        title={dq.question!}
        resultKind="date"
        unknownLabel="Je ne la trouve pas"
        onAnswer={onAnswer}
        onBack={() => setMode("choice")}
      />
    );
  }
  if (mode === "expiry") {
    return (
      <SimpleDateOrUnknownCard
        title="Quelle est la date limite de remplacement imprimée au dos du détecteur ?"
        resultKind="dueDate"
        unknownLabel="Je ne la trouve pas"
        futureYears
        onAnswer={onAnswer}
        onBack={() => setMode("choice")}
      />
    );
  }
  return (
    <div className={CARD_CLASS}>
      <BackLink onClick={onBack} />
      <h2 className="text-lg font-medium text-ink">{dq.question}</h2>
      <div className="flex flex-wrap gap-2">
        <button className={GHOST_BUTTON_CLASS} onClick={() => setMode("manufacture")}>
          Date de fabrication
        </button>
        <button className={GHOST_BUTTON_CLASS} onClick={() => setMode("expiry")}>
          Date limite de remplacement
        </button>
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "recent" })}>
          Je ne la trouve pas
        </button>
      </div>
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
        <h2 className="text-lg font-medium text-ink">Date de première immatriculation ?</h2>
        <div className="flex flex-wrap items-center gap-2">
          <MonthYearFields value={regValue} onChange={setRegValue} years={pastYearOptions()} disableFutureMonths />
          <button
            className={BUTTON_CLASS}
            disabled={!regIso}
            onClick={() => onAnswer({ dueDate: addYearsIso(regIso!, young.years) })}
          >
            Valider
          </button>
        </div>
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "recent" })}>
          Je ne sais pas
        </button>
      </div>
    );
  }

  return (
    <div className={CARD_CLASS}>
      <BackLink onClick={onBack} />
      <h2 className="text-lg font-medium text-ink">{dq.question}</h2>

      <div className="flex flex-wrap items-center gap-2">
        <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} disableFutureMonths />
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
        {young && (
          <button className={GHOST_BUTTON_CLASS} onClick={() => setShowYoung(true)}>
            {young.label}
          </button>
        )}
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "never" })}>
          Jamais ou je ne sais pas
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
    if (step.effects.maintenanceLevel) {
      lines.push({
        key: `${stepIndex}-level`,
        stepIndex,
        text: `Niveau d'entretien : ${MAINTENANCE_LEVEL_LABELS[step.effects.maintenanceLevel]}`,
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
        sub: dAnswers.length > 0 ? dAnswers.map(describeDateAnswer).join(", ") : undefined,
      });
    }
    for (const [typeId, dAnswers] of dateAnswersByType) {
      if (coveredTypes.has(typeId)) continue;
      lines.push({
        key: `${stepIndex}-date-${typeId}`,
        stepIndex,
        text: applianceLabel(typeId),
        sub: dAnswers.map(describeDateAnswer).join(", "),
      });
    }
    for (const check of step.effects.unknownChecks) {
      lines.push({ key: `${stepIndex}-check-${check.questionId}`, stepIndex, text: `À vérifier : ${check.questionLabel}` });
    }
  });

  return (
    <div className={CARD_CLASS}>
      {history.length > 0 && <BackLink onClick={onBack} />}
      <h2 className="text-lg font-medium text-ink">Récapitulatif</h2>
      <p className="text-sm text-ink-2">
        Rien n&apos;a encore été créé. Vérifiez ce qui va être ajouté à ce lieu, puis confirmez.
      </p>

      {lines.length === 0 ? (
        <p className="text-sm text-ink-2">Rien à créer pour ce lieu.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <li
              key={line.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium text-ink">{line.text}</span>
                {line.sub && <span className="ml-2 text-ink-2">({line.sub})</span>}
              </span>
              <button
                className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline"
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
