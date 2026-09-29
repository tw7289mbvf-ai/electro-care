import Link from "next/link";
import type { MaintenanceGuidanceItem, RealisedMaintenanceItem } from "@/lib/maintenance-guidance";
import { MaintenanceGuidanceActions } from "@/components/MaintenanceGuidanceActions";
import { ModifyMaintenanceCompletionButton } from "@/components/ModifyMaintenanceCompletionButton";
import { formatFrenchMonthYear } from "@/lib/french-dates";

// Appliance fiche's "entretien courant, au niveau choisi pour le lieu" (spec's "Managing
// Appliances"): "À faire" (this month's pending guidance, same engine as the place
// page's "Entretien du mois") and "Réalisé" (last completion + next date), for one
// appliance only.
export function ApplianceEntretienSection({
  applianceId,
  placeId,
  pending,
  realised,
  deferrableTaskKeys,
  upgradeTaskCount,
  upgradeLevelLabel,
}: {
  applianceId: string;
  placeId: string;
  pending: MaintenanceGuidanceItem[];
  realised: RealisedMaintenanceItem[];
  deferrableTaskKeys: Set<string>;
  // Set when this appliance has zero tasks at the place's current level but some at the
  // top level, so the section can point the user there instead of rendering nothing.
  upgradeTaskCount?: number;
  upgradeLevelLabel?: string;
}) {
  if (pending.length === 0 && realised.length === 0) {
    if (!upgradeTaskCount || !upgradeLevelLabel) return null;
    return (
      <section className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Entretien</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Aucun geste indispensable pour cet appareil. Passez au niveau {upgradeLevelLabel} pour voir{" "}
          {upgradeTaskCount === 1 ? "son" : "ses"} {upgradeTaskCount} geste{upgradeTaskCount > 1 ? "s" : ""} d&apos;entretien.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Entretien</h3>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">À faire</h4>
          <ul className="flex flex-col gap-2">
            {pending.map(({ task }) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <Link href={`/appliances/${applianceId}/tasks/${task.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                  {task.title}
                </Link>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {task.performer === "pro" ? "Professionnel" : `${task.activeMinutes} min`}
                </span>
                <MaintenanceGuidanceActions
                  applianceId={applianceId}
                  maintenanceTaskId={task.id}
                  placeId={placeId}
                  canDefer={deferrableTaskKeys.has(task.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {realised.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Réalisé</h4>
          <ul className="flex flex-col gap-2">
            {realised.map(({ task, completion, nextDate }) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <Link href={`/appliances/${applianceId}/tasks/${task.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                  {task.title}
                </Link>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Fait en {formatFrenchMonthYear(completion.doneMonth)} · prochaine : {formatFrenchMonthYear(nextDate)}
                </span>
                <ModifyMaintenanceCompletionButton
                  completionId={completion.id}
                  applianceId={applianceId}
                  maintenanceTaskId={task.id}
                  doneMonth={completion.doneMonth}
                  modifiedAt={completion.modifiedAt}
                  placeId={placeId}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
