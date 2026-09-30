"use client";

import { useState, useTransition } from "react";
import { editObligation } from "@/app/actions";
import { MonthYearFields, monthYearToIso, type MonthYearValue } from "@/components/MonthYearFields";
import { AttestationMockButton } from "@/components/AttestationMockButton";
import { pastYearOptions, formatFrenchDate } from "@/lib/french-dates";
import { BUTTON_CLASS, INPUT_CLASS, EDIT_WINDOW_CLASS, MODIFY_WARNING } from "@/components/inline-form-styles";

function isoToMonthYear(isoDate: string): MonthYearValue {
  const [year, month] = isoDate.split("-");
  return { month, year };
}

// "Modifier" on the fiche's "dernière intervention" (spec's "Managing Appliances"): only
// shown once a legal obligation already has a recorded intervention, whatever its
// current status — separate from MarkDoneButton, which records a brand new one.
export function ModifyObligationButton({
  completionId,
  applianceId,
  maintenanceTaskId,
  completedOn,
  providerName,
  providerContact,
  modifiedAt,
}: {
  completionId: string;
  applianceId: string;
  maintenanceTaskId: string;
  completedOn: string;
  providerName: string | null;
  providerContact: string | null;
  modifiedAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<MonthYearValue>(() => isoToMonthYear(completedOn));
  const [name, setName] = useState(providerName ?? "");
  const [contact, setContact] = useState(providerContact ?? "");
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
        if (!window.confirm("Confirmer la modification de cette intervention ?")) return;
        startTransition(async () => {
          const result = await editObligation(completionId, applianceId, maintenanceTaskId, iso.slice(0, 7), name, contact);
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
      <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} small />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Prestataire (facultatif)"
        className={INPUT_CLASS}
      />
      <input
        type="text"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="E-mail ou téléphone du prestataire (facultatif)"
        className={INPUT_CLASS}
      />
      <AttestationMockButton />
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
