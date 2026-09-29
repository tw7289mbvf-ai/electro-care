import Link from "next/link";
import type { MaintenanceTask } from "@/lib/maintenance-tasks";

// "Ses routines, plus fréquentes que mensuelles" (spec's "Managing Appliances"):
// informational only — no due date, no place-page guidance, no completion tracking —
// each still opening its fiche for the procedure (item 1: every task line is clickable).
export function ApplianceRoutinesSection({ applianceId, routines }: { applianceId: string; routines: MaintenanceTask[] }) {
  if (routines.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Routines</h3>
      <ul className="flex flex-col gap-2">
        {routines.map((task) => (
          <li key={task.id} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
            <Link href={`/appliances/${applianceId}/tasks/${task.id}`} className="flex flex-wrap items-center gap-2 hover:underline">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{task.title}</span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">{task.frequency.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
