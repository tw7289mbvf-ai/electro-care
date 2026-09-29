"use client";

import { useState } from "react";
import { getDateQuestionForTask, type DateQuestion } from "@/lib/date-questions";
import { VEHICLE_YOUNG_OPTION, addYearsIso, type DateAnswerResult } from "@/lib/date-answer";
import { MonthYearFields, monthYearToIso } from "@/components/MonthYearFields";
import { pastYearOptions, wideYearOptions } from "@/lib/french-dates";

const BUTTON_CLASS =
  "rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60";
const GHOST_BUTTON_CLASS =
  "rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

// Orange "Mettre à jour" (a date to pin down): the window asks the obligation's own
// date question (spec's "Actions and colours"), never a plain last-service month —
// that form is "C'est fait"'s (a fresh completion), a different question with a
// different shape (yes_no, expiry, vehicle registration... don't all reduce to "when
// did you last do it").
export function ObligationDateResolver({
  taskId,
  onAnswer,
  onCancel,
}: {
  taskId: string;
  onAnswer: (result: DateAnswerResult) => void;
  onCancel: () => void;
}) {
  const dq = getDateQuestionForTask(taskId);
  if (!dq) return null;

  switch (dq.kind) {
    case "expiry_date":
      return (
        <SimpleDateCard title={dq.question!} resultKind="dueDate" futureYears onAnswer={onAnswer} onCancel={onCancel} />
      );
    case "manufacture_date":
      return <SimpleDateCard title={dq.question!} resultKind="date" onAnswer={onAnswer} onCancel={onCancel} />;
    case "vehicle_inspection":
      return <VehicleInspectionResolver dq={dq} taskId={taskId} onAnswer={onAnswer} onCancel={onCancel} />;
    case "yes_no":
      return <YesNoResolver title={dq.question!} onAnswer={onAnswer} onCancel={onCancel} />;
    default:
      return <GradedMonthResolver dq={dq} onAnswer={onAnswer} onCancel={onCancel} />;
  }
}

function CancelLink({ onCancel }: { onCancel: () => void }) {
  return (
    <button type="button" onClick={onCancel} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
      Annuler
    </button>
  );
}

// REGLE-01: precise date -> normal computation; "il y a moins de {délai}", no exact
// date -> à confirmer (orange); "il y a plus de {délai}" -> en retard (rouge); "jamais"
// or "je ne sais pas" -> en retard, prioritaire.
function GradedMonthResolver({
  dq,
  onAnswer,
  onCancel,
}: {
  dq: DateQuestion;
  onAnswer: (result: DateAnswerResult) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState({ month: "", year: "" });
  const iso = monthYearToIso(value);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{dq.question}</p>
      <div className="flex flex-wrap items-center gap-2">
        <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} small />
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
        <CancelLink onCancel={onCancel} />
      </div>
    </div>
  );
}

// expiry_date (T-060, le tuyau de gaz): la date donnée devient l'échéance.
// manufacture_date (T-083, le détecteur): l'échéance = date + intervalLabel, calculée
// comme un passage normal (même mécanisme que graded_month).
function SimpleDateCard({
  title,
  resultKind,
  futureYears = false,
  onAnswer,
  onCancel,
}: {
  title: string;
  resultKind: "date" | "dueDate";
  futureYears?: boolean;
  onAnswer: (result: DateAnswerResult) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState({ month: "", year: "" });
  const iso = monthYearToIso(value);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
      <div className="flex flex-wrap items-center gap-2">
        <MonthYearFields value={value} onChange={setValue} years={futureYears ? wideYearOptions() : pastYearOptions()} small />
        <button
          className={BUTTON_CLASS}
          disabled={!iso}
          onClick={() => onAnswer(resultKind === "dueDate" ? { dueDate: iso! } : { date: iso! })}
        >
          Valider
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "recent" })}>
          Je ne trouve pas la date
        </button>
        <CancelLink onCancel={onCancel} />
      </div>
    </div>
  );
}

// yes_no (e.g. T-137, le puits déclaré en mairie): Oui -> conforme (vert), Non -> en
// retard (rouge), Je ne sais pas -> à confirmer (orange).
function YesNoResolver({
  title,
  onAnswer,
  onCancel,
}: {
  title: string;
  onAnswer: (result: DateAnswerResult) => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
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
        <CancelLink onCancel={onCancel} />
      </div>
    </div>
  );
}

// vehicle_inspection (T-152, T-153): comme graded_month, plus une option « Jamais,
// elle/il a moins de N ans » qui demande la date de première immatriculation ;
// échéance = cette date + N ans.
function VehicleInspectionResolver({
  dq,
  taskId,
  onAnswer,
  onCancel,
}: {
  dq: DateQuestion;
  taskId: string;
  onAnswer: (result: DateAnswerResult) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState({ month: "", year: "" });
  const [showYoung, setShowYoung] = useState(false);
  const [regValue, setRegValue] = useState({ month: "", year: "" });
  const young = VEHICLE_YOUNG_OPTION[taskId];
  const iso = monthYearToIso(value);
  const regIso = monthYearToIso(regValue);

  if (showYoung) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Date de première immatriculation ?</p>
        <div className="flex flex-wrap items-center gap-2">
          <MonthYearFields value={regValue} onChange={setRegValue} years={pastYearOptions()} small />
          <button
            className={BUTTON_CLASS}
            disabled={!regIso}
            onClick={() => onAnswer({ dueDate: addYearsIso(regIso!, young.years) })}
          >
            Valider
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={GHOST_BUTTON_CLASS} onClick={() => onAnswer({ confidence: "recent" })}>
            Je ne sais pas
          </button>
          <CancelLink onCancel={() => setShowYoung(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{dq.question}</p>
      <div className="flex flex-wrap items-center gap-2">
        <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} small />
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
        <CancelLink onCancel={onCancel} />
      </div>
    </div>
  );
}
