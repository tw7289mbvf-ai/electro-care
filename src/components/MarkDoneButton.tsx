"use client";

import { useState, useTransition } from "react";
import { markObligationDone } from "@/app/actions";

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function MarkDoneButton({
  applianceId,
  maintenanceTaskId,
}: {
  applianceId: string;
  maintenanceTaskId: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(currentMonthValue);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
      >
        C&apos;est fait
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await markObligationDone(applianceId, maintenanceTaskId, month);
          setOpen(false);
        });
      }}
      className="flex shrink-0 items-center gap-1.5"
    >
      <input
        type="month"
        required
        value={month}
        max={currentMonthValue()}
        onChange={(e) => setMonth(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
      <button
        type="submit"
        disabled={isPending}
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
