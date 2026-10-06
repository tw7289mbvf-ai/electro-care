"use client";

import { useTransition } from "react";
import { markMaintenanceTaskDone, deferMaintenanceTaskAction } from "@/app/actions";
import { BUTTON_DEFER, BUTTON_DONE } from "@/components/ui";

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
    <span className="ml-auto flex shrink-0 items-center gap-2">
      {canDefer && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => deferMaintenanceTaskAction(applianceId, maintenanceTaskId, placeId))}
          className={BUTTON_DEFER}
        >
          Reporter
        </button>
      )}
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => markMaintenanceTaskDone(applianceId, maintenanceTaskId, placeId))}
        className={BUTTON_DONE}
      >
        C&apos;est fait
      </button>
    </span>
  );
}
