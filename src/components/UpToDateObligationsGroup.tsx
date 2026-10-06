"use client";

import { useState } from "react";
import type { Appliance } from "@/lib/appliance-types";
import type { ObligationView } from "@/lib/obligations";
import type { ObligationCompletion } from "@/lib/obligation-completions";
import { formatFrenchMonthYear } from "@/lib/french-dates";
import { ObligationRow } from "@/components/ObligationRow";
import { Icon } from "@/components/ui";

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
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-3 rounded-2xl bg-ok-soft p-3.5 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-surface text-ok">
          <Icon name="check" strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold text-ink">
            {rows.length} obligation{rows.length > 1 ? "s" : ""} à jour
          </span>
          {nextDueDate && <span className="text-sm text-ok">Prochaine échéance en {formatFrenchMonthYear(nextDueDate)}</span>}
        </span>
        <span className="text-ok">
          <Icon name={open ? "up" : "down"} size={20} strokeWidth={2} />
        </span>
      </button>
      {open && (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <ObligationRow key={`${row.appliance.id}-${row.task.id}`} {...row} />
          ))}
        </ul>
      )}
    </div>
  );
}
