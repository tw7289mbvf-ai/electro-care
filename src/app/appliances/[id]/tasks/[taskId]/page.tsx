import { notFound } from "next/navigation";
import { getAppliance } from "@/lib/appliances";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import { getMaintenanceTask, PERFORMER_LABELS } from "@/lib/maintenance-tasks";
import { getMaintenanceCompletionHistory } from "@/lib/maintenance-completions";
import { formatFrenchMonthYear, currentMonthKey } from "@/lib/french-dates";
import { MarkMaintenanceDoneButton } from "@/components/MarkMaintenanceDoneButton";
import { ModifyMaintenanceCompletionButton } from "@/components/ModifyMaintenanceCompletionButton";
import { MaintenanceHistoryList } from "@/components/MaintenanceHistoryList";
import { BackLink } from "@/components/ui";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PERFORMER_STYLES: Record<"diy" | "pro", string> = {
  diy: "bg-ok-soft text-ok",
  pro: "bg-accent-soft text-accent",
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
  // the appliance card via ObligationsBlock/MarkDoneButton instead.
  const task = getMaintenanceTask(taskId);
  if (!task || task.legal === "yes" || task.equipmentTypeId !== appliance.equipmentTypeId) {
    notFound();
  }

  const history = await getMaintenanceCompletionHistory(appliance.id, task.id);
  const latest = history[0] ?? null;
  const olderEntries = history.slice(1);
  const doneThisMonth = latest?.doneMonth === currentMonthKey();

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pt-5 pb-10 sm:pt-8">
        <header>
          <BackLink href={`/appliances/${appliance.id}`}>Retour</BackLink>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink">
            {task.title}
          </h1>
          <p className="mt-1 text-sm text-ink-2">{getApplianceDisplayName(appliance)}</p>
        </header>

        <section className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink-2">
            Dernière réalisation
          </h2>
          {latest ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink">Fait en {formatFrenchMonthYear(latest.doneMonth)}</span>
              <ModifyMaintenanceCompletionButton
                completionId={latest.id}
                applianceId={appliance.id}
                maintenanceTaskId={task.id}
                doneMonth={latest.doneMonth}
                modifiedAt={latest.modifiedAt}
                placeId={appliance.placeId}
              />
            </div>
          ) : (
            <p className="text-sm text-ink-2">Jamais réalisée pour l&apos;instant.</p>
          )}
          <MaintenanceHistoryList
            olderEntries={olderEntries}
            applianceId={appliance.id}
            maintenanceTaskId={task.id}
            placeId={appliance.placeId}
          />
          <MarkMaintenanceDoneButton
            applianceId={appliance.id}
            maintenanceTaskId={task.id}
            placeId={appliance.placeId}
            done={doneThisMonth}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
          <span className={`w-fit rounded-md px-2 py-0.5 text-[13px] font-medium ${PERFORMER_STYLES[task.performer]}`}>
            {PERFORMER_LABELS[task.performer]}
          </span>
          <p className="text-sm text-ink">{task.procedure}</p>
          {task.tools && (
            <p className="text-sm text-ink-2">
              <span className="font-medium text-ink-2">Matériel : </span>
              {task.tools}
            </p>
          )}
          {task.ifSkipped && (
            <p className="text-sm text-ink-2">
              <span className="font-medium text-ink-2">En cas d&apos;oubli : </span>
              {task.ifSkipped}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
