"use client";

import { useTransition } from "react";
import { excludeMaintenanceTaskAction, restoreMaintenanceTaskAction } from "@/app/actions";
import { BUTTON_NEUTRAL } from "@/components/ui";

// Fiche de tâche d'entretien (spec "Maintenance Guidance"): a discreet link under the
// procedure, « Mon appareil n'a pas cet élément », behind a short confirmation. Once the
// task is ruled out, the fiche says so and offers « Rétablir » instead.
export function MaintenanceTaskNotApplicableLink({
  applianceId,
  maintenanceTaskId,
  placeId,
  excluded,
}: {
  applianceId: string;
  maintenanceTaskId: string;
  placeId: string;
  excluded: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (excluded) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-neutral-soft p-3.5">
        <p className="text-sm text-ink-2">Non concerné pour cet appareil : cette tâche n&apos;est plus proposée.</p>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => restoreMaintenanceTaskAction(applianceId, maintenanceTaskId, placeId))}
          className={BUTTON_NEUTRAL}
        >
          Rétablir
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm("Cette tâche ne sera plus proposée pour cet appareil. Vous pourrez la rétablir depuis la fiche de l'appareil. Confirmer ?")) return;
        startTransition(() => excludeMaintenanceTaskAction(applianceId, maintenanceTaskId, placeId));
      }}
      className="self-start text-[13px] text-ink-2 underline underline-offset-2"
    >
      Mon appareil n&apos;a pas cet élément
    </button>
  );
}
