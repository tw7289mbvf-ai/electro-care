"use client";

import { useState } from "react";
import type { MaintenanceCompletion } from "@/lib/maintenance-completions";
import { formatFrenchMonthYear } from "@/lib/french-dates";
import { ModifyMaintenanceCompletionButton } from "@/components/ModifyMaintenanceCompletionButton";

// Spec "Managing Appliances", "History, never overwritten — same principle for
// maintenance tasks": the most recent completion is shown above this as "Dernière
// réalisation"; this only lists the older ones, collapsed.
export function MaintenanceHistoryList({
  olderEntries,
  applianceId,
  maintenanceTaskId,
  placeId,
}: {
  olderEntries: MaintenanceCompletion[];
  applianceId: string;
  maintenanceTaskId: string;
  placeId: string;
}) {
  const [open, setOpen] = useState(false);

  if (olderEntries.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink hover:underline"
      >
        {olderEntries.length} réalisation{olderEntries.length > 1 ? "s" : ""} précédente
        {olderEntries.length > 1 ? "s" : ""} <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="mt-1 flex flex-col gap-1.5 border-l border-line pl-2">
          {olderEntries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <span>Fait en {formatFrenchMonthYear(entry.doneMonth)}</span>
              <ModifyMaintenanceCompletionButton
                completionId={entry.id}
                applianceId={applianceId}
                maintenanceTaskId={maintenanceTaskId}
                doneMonth={entry.doneMonth}
                modifiedAt={entry.modifiedAt}
                placeId={placeId}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
