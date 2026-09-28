"use client";

import { useTransition } from "react";
import { markMaintenanceTaskDone, deferMaintenanceTaskAction } from "@/app/actions";

// "C'est fait" fixes the next due date (marks the task done for the current month);
// "Reporter" pushes it to next month instead, capped by canDeferMaintenanceTask so it
// never skips a full interval — hidden once that cap is reached.
export function MaintenanceGuidanceActions({
  applianceId,
  maintenanceTaskId,
  placeId,
  canDefer,
}: {
  applianceId: string;
  maintenanceTaskId: string;
  placeId: string;
  canDefer: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5">
      {canDefer && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => deferMaintenanceTaskAction(applianceId, maintenanceTaskId, placeId))}
          className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950"
        >
          Reporter
        </button>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => markMaintenanceTaskDone(applianceId, maintenanceTaskId, placeId))}
        className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
      >
        C&apos;est fait
      </button>
    </span>
  );
}
