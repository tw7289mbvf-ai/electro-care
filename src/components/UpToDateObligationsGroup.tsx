"use client";

import { useState } from "react";
import type { Appliance } from "@/lib/appliance-types";
import type { ObligationView } from "@/lib/obligations";
import type { ObligationCompletion } from "@/lib/obligation-completions";
import { formatFrenchMonthYear } from "@/lib/french-dates";
import { ObligationRow } from "@/components/ObligationRow";

type Row = { appliance: Appliance; history?: ObligationCompletion[] } & ObligationView;

// Spec "Page du lieu": a collapsed "À jour" group with the count and the next action
// date, expanding on tap to the same rows as the red/orange obligations above it.
export function UpToDateObligationsGroup({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false);

  if (rows.length === 0) return null;

  const nextDueDate = rows
    .map((row) => row.dueDate)
    .filter((date): date is string => date !== null)
    .sort()[0];

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-left text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        <span>
          {rows.length} à jour
          {nextDueDate && <> · prochaine échéance : {formatFrenchMonthYear(nextDueDate)}</>}
        </span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <ObligationRow key={`${row.appliance.id}-${row.task.id}`} {...row} />
          ))}
        </ul>
      )}
    </div>
  );
}
