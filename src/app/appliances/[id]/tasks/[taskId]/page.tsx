import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppliance } from "@/lib/appliances";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import { getMaintenanceTask, PERFORMER_LABELS } from "@/lib/maintenance-tasks";
import { isMaintenanceTaskDoneThisMonth } from "@/lib/maintenance-completions";
import { currentMonthKey } from "@/lib/french-dates";
import { MarkMaintenanceDoneButton } from "@/components/MarkMaintenanceDoneButton";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PERFORMER_STYLES: Record<"diy" | "pro", string> = {
  diy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  pro: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
};

export default async function MaintenanceTaskPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id, taskId } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  const appliance = await getAppliance(id);
  if (!appliance) {
    notFound();
  }
  // Fiche de tâche only covers "Entretien" (non-legal) tasks — legal obligations live on
  // the place page via ObligationsBlock/MarkDoneButton instead.
  const task = getMaintenanceTask(taskId);
  if (!task || task.legal === "yes" || task.equipmentTypeId !== appliance.equipmentTypeId) {
    notFound();
  }

  const done = await isMaintenanceTaskDoneThisMonth(appliance.id, task.id, currentMonthKey());

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <Link
            href={`/places/${appliance.placeId}`}
            className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            ← Retour
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {task.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{getApplianceDisplayName(appliance)}</p>
        </header>

        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${PERFORMER_STYLES[task.performer]}`}>
            {PERFORMER_LABELS[task.performer]}
          </span>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{task.procedure}</p>
          {task.tools && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-600 dark:text-zinc-300">Matériel : </span>
              {task.tools}
            </p>
          )}
          {task.ifSkipped && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-600 dark:text-zinc-300">En cas d&apos;oubli : </span>
              {task.ifSkipped}
            </p>
          )}
        </section>

        <MarkMaintenanceDoneButton
          applianceId={appliance.id}
          maintenanceTaskId={task.id}
          placeId={appliance.placeId}
          done={done}
        />
      </main>
    </div>
  );
}
