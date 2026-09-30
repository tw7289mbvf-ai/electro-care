import type { Appliance } from "@/lib/appliance-types";
import { compareObligationsByUrgency, getObligationsForAppliance, type ApplianceObligationRecord } from "@/lib/obligations";
import type { PlaceCheck } from "@/lib/place-checks";
import type { ObligationCompletion } from "@/lib/obligation-completions";
import { ObligationRow } from "@/components/ObligationRow";
import { UpToDateObligationsGroup } from "@/components/UpToDateObligationsGroup";

export function ObligationsBlock({
  appliances,
  obligationRecords,
  placeChecks,
  completionsByTaskId,
}: {
  appliances: Appliance[];
  obligationRecords: ApplianceObligationRecord[];
  placeChecks: PlaceCheck[];
  // Full "C'est fait" history, keyed by maintenance task id, most recent first — passed
  // only from the appliance fiche (a single appliance) so "Modifier" and the history
  // list stay off the dashboard and place page (spec's "Managing Appliances").
  completionsByTaskId?: Map<string, ObligationCompletion[]>;
}) {
  const rows = appliances
    .flatMap((appliance) => {
      if (!appliance.equipmentTypeId) return [];
      const records = obligationRecords.filter((r) => r.applianceId === appliance.id);
      return getObligationsForAppliance(appliance.equipmentTypeId, records, appliance.powerKw).map((obligation) => ({
        appliance,
        ...obligation,
        history: completionsByTaskId?.get(obligation.task.id) ?? undefined,
      }));
    })
    .sort(compareObligationsByUrgency);

  if (rows.length === 0 && placeChecks.length === 0) return null;

  // Spec "Page du lieu": obligations to act on first (red then orange, "à planifier"
  // alongside them since it also needs an answer), then the up-to-date ones collapsed.
  const activeRows = rows.filter((row) => row.status !== "up_to_date");
  const upToDateRows = rows.filter((row) => row.status === "up_to_date");

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Obligations
      </h3>

      {activeRows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {activeRows.map((row) => (
            <ObligationRow key={`${row.appliance.id}-${row.task.id}`} {...row} />
          ))}
        </ul>
      )}

      <UpToDateObligationsGroup rows={upToDateRows} />

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
