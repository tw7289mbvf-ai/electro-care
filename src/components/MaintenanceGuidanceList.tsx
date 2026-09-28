import Link from "next/link";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import type { MaintenanceGuidanceItem } from "@/lib/maintenance-guidance";
import { MaintenanceGuidanceActions } from "@/components/MaintenanceGuidanceActions";

// Place page "l'entretien du mois": lifespan maintenance tasks due this month, each
// leading to its fiche de tâche for the procedure, with "C'est fait" and "Reporter"
// right on the row.
export function MaintenanceGuidanceList({
  items,
  placeId,
  deferrableTaskKeys,
}: {
  items: MaintenanceGuidanceItem[];
  placeId: string;
  deferrableTaskKeys: Set<string>;
}) {
  if (items.length === 0) return null;

  const totalMinutes = items.reduce((sum, { task }) => sum + task.activeMinutes, 0);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Entretien du mois
        {totalMinutes > 0 && (
          <span className="font-normal text-zinc-400 dark:text-zinc-500"> · environ {totalMinutes} min</span>
        )}
      </h3>
      <ul className="flex flex-col gap-2">
        {items.map(({ appliance, task }) => (
          <li
            key={`${appliance.id}-${task.id}`}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
          >
            <Link
              href={`/appliances/${appliance.id}/tasks/${task.id}`}
              className="flex flex-wrap items-center gap-2 hover:underline"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{task.title}</span>
              <span className="text-zinc-500 dark:text-zinc-400">— {getApplianceDisplayName(appliance)}</span>
            </Link>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {task.performer === "pro" ? "Professionnel" : `${task.activeMinutes} min`}
            </span>
            <MaintenanceGuidanceActions
              applianceId={appliance.id}
              maintenanceTaskId={task.id}
              placeId={placeId}
              canDefer={deferrableTaskKeys.has(`${appliance.id}:${task.id}`)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
