"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MaintenanceLevelOptions } from "@/components/MaintenanceLevelOptions";
import type { MaintenanceLevel } from "@/lib/maintenance-levels";
import { updatePlaceMaintenanceLevelAction } from "@/app/actions";
import { Section } from "@/components/ui";

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
    <Section title="Niveau d&apos;entretien">
      <MaintenanceLevelOptions value={level} onChange={handleChange} estimates={estimates} />
      {isPending && <p className="text-sm text-ink-2">Enregistrement…</p>}
    </Section>
  );
}
