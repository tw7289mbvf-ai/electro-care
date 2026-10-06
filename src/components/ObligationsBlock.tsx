import type { Appliance } from "@/lib/appliance-types";
import { compareObligationsByUrgency, getObligationsForAppliance, type ApplianceObligationRecord } from "@/lib/obligations";
import type { PlaceCheck } from "@/lib/place-checks";
import type { ObligationCompletion } from "@/lib/obligation-completions";
import type { ObligationAppointment } from "@/lib/obligation-appointments";
import { ObligationRow } from "@/components/ObligationRow";
import { UpToDateObligationsGroup } from "@/components/UpToDateObligationsGroup";
import { Section } from "@/components/ui";

export function ObligationsBlock({
  appliances,
  obligationRecords,
  appointments,
  placeChecks,
  completionsByTaskId,
}: {
  appliances: Appliance[];
  obligationRecords: ApplianceObligationRecord[];
  appointments?: ObligationAppointment[];
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
        history: completionsByTaskId ? (completionsByTaskId.get(obligation.task.id) ?? []) : undefined,
        appointment:
          appointments?.find((a) => a.applianceId === appliance.id && a.maintenanceTaskId === obligation.task.id) ?? null,
      }));
    })
    .sort(compareObligationsByUrgency);

  if (rows.length === 0 && placeChecks.length === 0) return null;

  // Spec "Page du lieu": obligations to act on first (red then orange, "à planifier"
  // alongside them since it also needs an answer), then the up-to-date ones collapsed.
  const activeRows = rows.filter((row) => row.status !== "up_to_date");
  const upToDateRows = rows.filter((row) => row.status === "up_to_date");

  return (
    <Section title="Obligations">
      {activeRows.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {activeRows.map((row) => (
            <ObligationRow key={`${row.appliance.id}-${row.task.id}`} {...row} />
          ))}
        </ul>
      )}

      <UpToDateObligationsGroup rows={upToDateRows} />

      {placeChecks.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3.5">
          <h3 className="text-[13px] font-semibold text-ink-2">À vérifier</h3>
          <ul className="flex flex-col gap-2">
            {placeChecks.map((check) => (
              <li key={check.id} className="text-sm text-ink">
                {check.questionLabel}
                {check.help && <span className="block text-[13px] text-ink-2">{check.help}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
