"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { markObligationDone } from "@/app/actions";
import { MonthYearFields, monthYearToIso } from "@/components/MonthYearFields";
import { pastYearOptions } from "@/lib/french-dates";
import type { ObligationStatus } from "@/lib/obligations";

function currentMonthValue() {
  const now = new Date();
  return { month: String(now.getMonth() + 1).padStart(2, "0"), year: String(now.getFullYear()) };
}

// Spec "Actions by status": green shows no button; red (or "à planifier", no data yet)
// shows "C'est fait"; orange shows "Mettre à jour" — a date picker when the obligation
// is missing a date, or a link to the appliance card when it's missing the power/
// threshold that would resolve legalStatus "conditional".
export function MarkDoneButton({
  applianceId,
  maintenanceTaskId,
  status,
  toConfirmReason,
}: {
  applianceId: string;
  maintenanceTaskId: string;
  status: ObligationStatus;
  toConfirmReason: "date" | "threshold" | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentMonthValue);
  const [isPending, startTransition] = useTransition();

  if (status === "up_to_date") return null;

  const isToConfirm = status === "to_confirm";
  const label = isToConfirm ? "Mettre à jour" : "C'est fait";
  const closedButtonClass = isToConfirm
    ? "shrink-0 rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100 dark:bg-orange-950/50 dark:text-orange-300 dark:hover:bg-orange-950"
    : "shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950";

  if (isToConfirm && toConfirmReason === "threshold") {
    return (
      <Link href={`/appliances/${applianceId}`} className={closedButtonClass}>
        {label}
      </Link>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={closedButtonClass}>
        {label}
      </button>
    );
  }

  const iso = monthYearToIso(value);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!iso) return;
        startTransition(async () => {
          await markObligationDone(applianceId, maintenanceTaskId, iso.slice(0, 7));
          setOpen(false);
        });
      }}
      className="flex shrink-0 items-center gap-1.5"
    >
      <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} small />
      <button
        type="submit"
        disabled={isPending || !iso}
        className="rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {isPending ? "…" : "Valider"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        Annuler
      </button>
    </form>
  );
}
