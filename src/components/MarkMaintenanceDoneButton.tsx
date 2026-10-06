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
    return <p className="text-sm font-semibold text-ok">Fait ce mois-ci</p>;
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markMaintenanceTaskDone(applianceId, maintenanceTaskId, placeId);
          router.push(`/appliances/${applianceId}`);
        })
      }
      className="self-start inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 font-semibold text-on-accent transition-colors hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "…" : "C'est fait"}
    </button>
  );
}
