"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MaintenanceLevelOptions } from "@/components/MaintenanceLevelOptions";
import type { MaintenanceLevel } from "@/lib/maintenance-levels";
import { updatePlaceMaintenanceLevelAction } from "@/app/actions";

export function MaintenanceLevelPicker({
  placeId,
  level,
  estimates,
}: {
  placeId: string;
  level: MaintenanceLevel;
  estimates: Record<MaintenanceLevel, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: MaintenanceLevel) {
    startTransition(async () => {
      await updatePlaceMaintenanceLevelAction(placeId, next);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Niveau d&apos;entretien
      </h2>
      <MaintenanceLevelOptions value={level} onChange={handleChange} estimates={estimates} />
      {isPending && <p className="text-xs text-zinc-400">Enregistrement…</p>}
    </section>
  );
}
