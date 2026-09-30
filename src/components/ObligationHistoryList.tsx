"use client";

import { useState } from "react";
import type { ObligationCompletion } from "@/lib/obligation-completions";
import { formatFrenchMonthYear } from "@/lib/french-dates";
import { ModifyObligationButton } from "@/components/ModifyObligationButton";

// Spec "Managing Appliances", "History, never overwritten": the most recent entry is
// already shown inline above this (ObligationRow), so this only lists the older ones,
// collapsed — appliance fiche only (ObligationRow only passes olderEntries there).
export function ObligationHistoryList({
  olderEntries,
  applianceId,
  maintenanceTaskId,
}: {
  olderEntries: ObligationCompletion[];
  applianceId: string;
  maintenanceTaskId: string;
}) {
  const [open, setOpen] = useState(false);

  if (olderEntries.length === 0) return null;

  return (
    <div className="pl-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400"
      >
        {olderEntries.length} intervention{olderEntries.length > 1 ? "s" : ""} précédente
        {olderEntries.length > 1 ? "s" : ""} <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="mt-1 flex flex-col gap-1.5 border-l border-zinc-200 pl-2 dark:border-zinc-700">
          {olderEntries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                Fait en {formatFrenchMonthYear(entry.serviceDate)}
                {entry.providerName ? ` par ${entry.providerName}` : ""}
                {entry.providerContact ? ` (${entry.providerContact})` : ""}
              </span>
              <ModifyObligationButton
                completionId={entry.id}
                applianceId={applianceId}
                maintenanceTaskId={maintenanceTaskId}
                completedOn={entry.serviceDate}
                providerName={entry.providerName}
                providerContact={entry.providerContact}
                modifiedAt={entry.modifiedAt}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
