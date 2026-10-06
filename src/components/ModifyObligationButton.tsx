"use client";

import { useState, useTransition } from "react";
import { editObligation } from "@/app/actions";
import { MonthYearFields, monthYearToIso, type MonthYearValue } from "@/components/MonthYearFields";
import { AttestationMockButton } from "@/components/AttestationMockButton";
import { pastYearOptions, formatFrenchDate } from "@/lib/french-dates";
import { BUTTON_CLASS, INPUT_CLASS, EDIT_WINDOW_CLASS, MODIFY_WARNING, TEXT_BUTTON_CLASS } from "@/components/inline-form-styles";
import { BUTTON_NEUTRAL } from "@/components/ui";

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
      <p className="text-warn">{MODIFY_WARNING}</p>
      <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} small disableFutureMonths />
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
