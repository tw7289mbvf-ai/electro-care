"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markMaintenanceTaskDone } from "@/app/actions";

export function MarkMaintenanceDoneButton({
  applianceId,
  maintenanceTaskId,
  placeId,
  done,
}: {
  applianceId: string;
  maintenanceTaskId: string;
  placeId: string;
  done: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (done) {
    return <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Fait ce mois-ci</p>;
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markMaintenanceTaskDone(applianceId, maintenanceTaskId, placeId);
          router.push(`/places/${placeId}`);
        })
      }
      className="self-start rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "…" : "C'est fait"}
    </button>
  );
}
