"use client";

import { useState, useTransition } from "react";
import { editMaintenanceCompletionAction } from "@/app/actions";
import { MonthYearFields, monthYearToIso, type MonthYearValue } from "@/components/MonthYearFields";
import { pastYearOptions, formatFrenchDate } from "@/lib/french-dates";
import { BUTTON_CLASS, EDIT_WINDOW_CLASS, MODIFY_WARNING, TEXT_BUTTON_CLASS } from "@/components/inline-form-styles";
import { BUTTON_NEUTRAL } from "@/components/ui";

function monthKeyToMonthYear(monthKey: string): MonthYearValue {
  const [year, month] = monthKey.split("-");
  return { month, year };
}

// "Modifier" on a past realisation (spec's "Managing Appliances" / "Fiche de tâche"):
// the lifespan-maintenance counterpart of ModifyObligationButton — a month only, no
// provider (entretien courant is app-only, never a professional's intervention record).
export function ModifyMaintenanceCompletionButton({
  completionId,
  applianceId,
  maintenanceTaskId,
  doneMonth,
  modifiedAt,
  placeId,
}: {
  completionId: string;
  applianceId: string;
  maintenanceTaskId: string;
  doneMonth: string;
  modifiedAt: string | null;
  placeId: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<MonthYearValue>(() => monthKeyToMonthYear(doneMonth));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        {modifiedAt && (
          <span className="text-[13px] text-ink-2">Modifiée le {formatFrenchDate(modifiedAt)}</span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={BUTTON_NEUTRAL}
        >
          Modifier
        </button>
      </span>
    );
  }

  const iso = monthYearToIso(value);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!iso) return;
        if (!window.confirm("Confirmer la modification de cette réalisation ?")) return;
        startTransition(async () => {
          const result = await editMaintenanceCompletionAction({
            id: completionId,
            applianceId,
            maintenanceTaskId,
            month: iso.slice(0, 7),
            placeId,
          });
          if (result.error) {
            setError(result.error);
            return;
          }
          setError(null);
          setOpen(false);
        });
      }}
      className={EDIT_WINDOW_CLASS}
    >
      <p className="text-warn">{MODIFY_WARNING}</p>
      <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} small disableFutureMonths />
      {error && <p className="text-late">{error}</p>}
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
