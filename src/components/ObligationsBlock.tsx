import type { Appliance } from "@/lib/appliance-types";
import { compareObligationsByUrgency, getObligationsForAppliance, type ApplianceObligationRecord } from "@/lib/obligations";
import type { PlaceCheck } from "@/lib/place-checks";
import { ObligationRow } from "@/components/ObligationRow";

export function ObligationsBlock({
  appliances,
  obligationRecords,
  placeChecks,
}: {
  appliances: Appliance[];
  obligationRecords: ApplianceObligationRecord[];
  placeChecks: PlaceCheck[];
}) {
  const rows = appliances
    .flatMap((appliance) => {
      if (!appliance.equipmentTypeId) return [];
      const records = obligationRecords.filter((r) => r.applianceId === appliance.id);
      return getObligationsForAppliance(appliance.equipmentTypeId, records).map((obligation) => ({
        appliance,
        ...obligation,
      }));
    })
    .sort(compareObligationsByUrgency);

  if (rows.length === 0 && placeChecks.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Obligations
      </h3>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <ObligationRow key={`${row.appliance.id}-${row.task.id}`} {...row} />
          ))}
        </ul>
      )}

      {placeChecks.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            À vérifier
          </h4>
          <ul className="flex flex-col gap-1.5">
            {placeChecks.map((check) => (
              <li key={check.id} className="text-sm text-zinc-600 dark:text-zinc-400">
                {check.questionLabel}
                {check.help && <span className="block text-xs text-zinc-400 dark:text-zinc-500">{check.help}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
