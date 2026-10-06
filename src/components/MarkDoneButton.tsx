"use client";

import { useState, useTransition } from "react";
import { markObligationDone, resolveObligationDate, resolveObligationThreshold } from "@/app/actions";
import { MonthYearFields, monthYearToIso } from "@/components/MonthYearFields";
import { pastYearOptions } from "@/lib/french-dates";
import { ObligationDateResolver } from "@/components/ObligationDateResolver";
import { AttestationMockButton } from "@/components/AttestationMockButton";
import { BUTTON_CLASS, GHOST_BUTTON_CLASS, INPUT_CLASS, WINDOW_CLASS, TEXT_BUTTON_CLASS } from "@/components/inline-form-styles";
import type { DateAnswerResult } from "@/lib/date-answer";
import type { ObligationStatus } from "@/lib/obligations";
import { BUTTON_DONE, BUTTON_OUTLINE, BUTTON_UPDATE } from "@/components/ui";
import { SmokeDetectorKindFlow } from "@/components/SmokeDetectorKindFlow";
import { getDateQuestionForTask } from "@/lib/date-questions";
import { SMOKE_DETECTOR_QUESTION_TASK } from "@/lib/smoke-detectors";

function currentMonthValue() {
  const now = new Date();
  return { month: String(now.getMonth() + 1).padStart(2, "0"), year: String(now.getFullYear()) };
}

// Orange "Mettre à jour" — power threshold (spec's "Actions and colours"): "Moins de
// 4 kW" and "4 kW ou plus" store a nominal figure on the safe side of the 4 kW
// threshold (3.9 / 4) rather than the appliance's real, unknown wattage — the appliance
// card can always be corrected later with the exact figure. "Je ne sais pas" leaves the
// power unset and simply closes the window (nothing to save: same as before).
function PowerThresholdForm({ applianceId, onDone, onCancel }: { applianceId: string; onDone: () => void; onCancel: () => void }) {
  const [figure, setFigure] = useState("");
  const [isPending, startTransition] = useTransition();
  const figureNum = Number(figure);
  const figureValid = figure.trim() !== "" && Number.isFinite(figureNum) && figureNum > 0;

  function submit(powerKw: number) {
    startTransition(async () => {
      await resolveObligationThreshold(applianceId, powerKw);
      onDone();
    });
  }

  return (
    <div className={WINDOW_CLASS}>
      <p className="text-ink">
        Quelle est la puissance du groupe extérieur ? (inscrite sur sa plaque ; pour un multisplit, c&apos;est la
        puissance de l&apos;unité extérieure qui compte.)
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={isPending} className={GHOST_BUTTON_CLASS} onClick={() => submit(3.9)}>
          Moins de 4 kW
        </button>
        <button type="button" disabled={isPending} className={GHOST_BUTTON_CLASS} onClick={() => submit(4)}>
          4 kW ou plus
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          step="0.1"
          min="0"
          value={figure}
          onChange={(e) => setFigure(e.target.value)}
          placeholder="Puissance (kW)"
          className={INPUT_CLASS}
        />
        <button type="button" disabled={isPending || !figureValid} className={BUTTON_CLASS} onClick={() => submit(figureNum)}>
          {isPending ? "…" : "Valider"}
        </button>
      </div>
      <button type="button" onClick={onCancel} className={`self-start ${TEXT_BUTTON_CLASS}`}>
        Je ne sais pas
      </button>
    </div>
  );
}

// Spec "Actions and colours": green shows no button, red shows "C'est fait", orange
// shows "Mettre à jour" — a window aimed at exactly what's missing, never the generic
// appliance form: the obligation's own date question when it's a date, or the power
// question when it's a threshold. "Non concerné" (power below the threshold), like "À
// jour", shows no button.
export function MarkDoneButton({
  applianceId,
  maintenanceTaskId,
  status,
  toConfirmReason,
  onFiche = false,
}: {
  applianceId: string;
  maintenanceTaskId: string;
  status: ObligationStatus;
  toConfirmReason: "date" | "threshold" | null;
  onFiche?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [linkedToAlarm, setLinkedToAlarm] = useState(false);
  const [value, setValue] = useState(currentMonthValue);
  const [providerName, setProviderName] = useState("");
  const [providerContact, setProviderContact] = useState("");
  const [isPending, startTransition] = useTransition();

  // A detector followed by a monitoring provider stays green; its fiche still records the
  // provider's visits, as interventions (spec, "Smoke detector").
  const isMonitored = getDateQuestionForTask(maintenanceTaskId)?.kind === "monitored";
  if (status === "not_applicable") return null;
  if (status === "up_to_date" && !(isMonitored && onFiche)) return null;

  const isToConfirm = status === "to_confirm";
  const label = isToConfirm ? "Mettre à jour" : isMonitored ? "Enregistrer une visite" : "C'est fait";
  const closedButtonClass = isToConfirm
    ? BUTTON_UPDATE
    : isMonitored
      ? BUTTON_OUTLINE
      : BUTTON_DONE;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={closedButtonClass}>
        {label}
      </button>
    );
  }

  if (isToConfirm && toConfirmReason === "threshold") {
    return <PowerThresholdForm applianceId={applianceId} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />;
  }

  if (isToConfirm && toConfirmReason === "date" && linkedToAlarm) {
    return (
      <div className={WINDOW_CLASS}>
        <SmokeDetectorKindFlow
          applianceId={applianceId}
          startAt="monitoring"
          onDone={() => setOpen(false)}
          onCancel={() => setLinkedToAlarm(false)}
        />
      </div>
    );
  }

  if (isToConfirm && toConfirmReason === "date") {
    const handleAnswer = (result: DateAnswerResult) => {
      startTransition(async () => {
        await resolveObligationDate(applianceId, maintenanceTaskId, result);
        setOpen(false);
      });
    };
    return (
      <div className={WINDOW_CLASS}>
        <ObligationDateResolver taskId={maintenanceTaskId} onAnswer={handleAnswer} onCancel={() => setOpen(false)} />
        {/* A standalone detector whose date is unknown may in fact be linked to an alarm
            (spec, "Smoke detector"): switching it asks the alarm's own questions. */}
        {maintenanceTaskId === SMOKE_DETECTOR_QUESTION_TASK.standalone && (
          <button type="button" onClick={() => setLinkedToAlarm(true)} className={`self-start ${GHOST_BUTTON_CLASS}`}>
            Il est relié à mon alarme
          </button>
        )}
        {isPending && <p className="text-ink-2">…</p>}
      </div>
    );
  }

  const iso = monthYearToIso(value);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!iso) return;
        startTransition(async () => {
          await markObligationDone(applianceId, maintenanceTaskId, iso.slice(0, 7), providerName, providerContact);
          setOpen(false);
        });
      }}
      className={WINDOW_CLASS}
    >
      <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} small disableFutureMonths />
      <input
        type="text"
        value={providerName}
        onChange={(e) => setProviderName(e.target.value)}
        placeholder="Prestataire (facultatif)"
        className={INPUT_CLASS}
      />
      <input
        type="text"
        value={providerContact}
        onChange={(e) => setProviderContact(e.target.value)}
        placeholder="E-mail ou téléphone du prestataire (facultatif)"
        className={INPUT_CLASS}
      />
      <AttestationMockButton />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={isPending || !iso} className={BUTTON_CLASS}>
          {isPending ? "…" : "Valider"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={TEXT_BUTTON_CLASS}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
