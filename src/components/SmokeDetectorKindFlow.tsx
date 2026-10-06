"use client";

import { useState, useTransition } from "react";
import { setSmokeDetectorKind } from "@/app/actions";
import { ObligationDateResolver } from "@/components/ObligationDateResolver";
import { BUTTON_CLASS, GHOST_BUTTON_CLASS, TEXT_BUTTON_CLASS } from "@/components/inline-form-styles";
import type { DateAnswerResult } from "@/lib/date-answer";
import { SMOKE_DETECTOR_QUESTION_TASK, type SmokeDetectorKind } from "@/lib/smoke-detectors";

type Step = { name: "type" } | { name: "monitoring" } | { name: "question"; kind: SmokeDetectorKind };

// Changing a smoke detector's kind (spec, Onboarding Questionnaire, "Smoke detector"):
// "Détecteur autonome" or "Relié à mon alarme", then for an alarm "Votre alarme
// est-elle télésurveillée par un prestataire ?", then the new kind's own question — the
// date on the back (autonome, or relié non télésurveillé) or the CE EN 14604 marking
// (télésurveillé). From the fiche it starts at the type; from the orange "Mettre à
// jour" window's "Il est relié à mon alarme", at the monitoring question.
export function SmokeDetectorKindFlow({
  applianceId,
  startAt,
  onDone,
  onCancel,
}: {
  applianceId: string;
  startAt: "type" | "monitoring";
  onDone: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>(startAt === "type" ? { name: "type" } : { name: "monitoring" });
  const [isPending, startTransition] = useTransition();

  function submit(kind: SmokeDetectorKind, answer: DateAnswerResult) {
    startTransition(async () => {
      await setSmokeDetectorKind(applianceId, kind, answer);
      onDone();
    });
  }

  if (step.name === "type") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">Quel type de détecteur ?</p>
        <div className="flex flex-wrap gap-2">
          <button className={GHOST_BUTTON_CLASS} onClick={() => setStep({ name: "question", kind: "standalone" })}>
            Détecteur autonome
          </button>
          <button className={GHOST_BUTTON_CLASS} onClick={() => setStep({ name: "monitoring" })}>
            Relié à mon alarme
          </button>
          <button type="button" onClick={onCancel} className={TEXT_BUTTON_CLASS}>
            Annuler
          </button>
        </div>
      </div>
    );
  }

  if (step.name === "monitoring") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">Votre alarme est-elle télésurveillée par un prestataire ?</p>
        <div className="flex flex-wrap gap-2">
          <button className={BUTTON_CLASS} onClick={() => setStep({ name: "question", kind: "monitored" })}>
            Oui
          </button>
          <button className={GHOST_BUTTON_CLASS} onClick={() => setStep({ name: "question", kind: "alarm" })}>
            Non
          </button>
          {/* Never blocking: without knowing, the detector is followed like an
              unmonitored one (monthly test, replacement date), the safe side. */}
          <button className={GHOST_BUTTON_CLASS} onClick={() => setStep({ name: "question", kind: "alarm" })}>
            Je ne sais pas
          </button>
          <button type="button" onClick={onCancel} className={TEXT_BUTTON_CLASS}>
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ObligationDateResolver
        taskId={SMOKE_DETECTOR_QUESTION_TASK[step.kind]}
        onAnswer={(answer) => submit(step.kind, answer)}
        onCancel={onCancel}
      />
      {isPending && <p className="text-ink-2">…</p>}
    </div>
  );
}
