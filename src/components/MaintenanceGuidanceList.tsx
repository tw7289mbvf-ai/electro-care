import Link from "next/link";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import type { MaintenanceGuidanceItem } from "@/lib/maintenance-guidance";

// Place page "l'entretien du mois": lifespan maintenance tasks due this month, each
// leading to its fiche de tâche for the procedure and "C'est fait".
export function MaintenanceGuidanceList({ items }: { items: MaintenanceGuidanceItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Entretien du mois
      </h3>
      <ul className="flex flex-col gap-2">
        {items.map(({ appliance, task }) => (
          <li key={`${appliance.id}-${task.id}`}>
            <Link
              href={`/appliances/${appliance.id}/tasks/${task.id}`}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:border-emerald-300 dark:border-zinc-800 dark:hover:border-emerald-700"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{task.title}</span>
              <span className="text-zinc-500 dark:text-zinc-400">— {getApplianceDisplayName(appliance)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
