"use client";

import { useState, useTransition } from "react";
import { editMaintenanceCompletionAction } from "@/app/actions";
import { MonthYearFields, monthYearToIso, type MonthYearValue } from "@/components/MonthYearFields";
import { pastYearOptions, formatFrenchDate } from "@/lib/french-dates";
import { BUTTON_CLASS, EDIT_WINDOW_CLASS, MODIFY_WARNING } from "@/components/inline-form-styles";

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
          <span className="text-xs text-zinc-400 dark:text-zinc-500">modifiée le {formatFrenchDate(modifiedAt)}</span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
      <p className="text-orange-800 dark:text-orange-300">{MODIFY_WARNING}</p>
      <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} small disableFutureMonths />
      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={isPending || !iso} className={BUTTON_CLASS}>
          {isPending ? "…" : "Valider"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
