import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplianceEditForm } from "@/components/ApplianceEditForm";
import { DeleteApplianceButton } from "@/components/DeleteApplianceButton";
import { ObligationsBlock } from "@/components/ObligationsBlock";
import { ApplianceEntretienSection } from "@/components/ApplianceEntretienSection";
import { ApplianceRoutinesSection } from "@/components/ApplianceRoutinesSection";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import { getAppliance } from "@/lib/appliances";
import { getPlace } from "@/lib/places";
import { getObligationRecordsForAppliance } from "@/lib/appliance-obligations";
import { getObligationCompletionsForAppliance } from "@/lib/obligation-completions";
import { getMaintenanceCompletionsForPlace, getLatestMaintenanceCompletionsForAppliance } from "@/lib/maintenance-completions";
import { getMaintenanceDeferralsForPlace } from "@/lib/maintenance-deferrals";
import {
  getMaintenanceGuidanceForAppliances,
  getUpcomingApplianceTasks,
  filterPendingGuidance,
  applyDeferrals,
  canDeferMaintenanceTask,
} from "@/lib/maintenance-guidance";
import { getRoutineMaintenanceTasks } from "@/lib/maintenance-tasks";
import {
  isTaskIncludedAtLevel,
  countMaintenanceTasksAtLevel,
  MAX_MAINTENANCE_LEVEL,
  MAINTENANCE_LEVEL_LABELS,
} from "@/lib/maintenance-levels";
import { currentMonthKey } from "@/lib/french-dates";
import { updateAppliance } from "@/app/actions";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AppliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  const appliance = await getAppliance(id);
  if (!appliance) {
    notFound();
  }
  const place = await getPlace(appliance.placeId);
  if (!place) {
    notFound();
  }

  const month = currentMonthKey();
  const [obligationRecords, obligationCompletions, placeCompletions, placeDeferrals, latestCompletions] = await Promise.all([
    getObligationRecordsForAppliance(id),
    getObligationCompletionsForAppliance(id),
    getMaintenanceCompletionsForPlace(appliance.placeId, month),
    getMaintenanceDeferralsForPlace(appliance.placeId),
    getLatestMaintenanceCompletionsForAppliance(id),
  ]);
  const completions = placeCompletions.filter((c) => c.applianceId === id);
  const deferrals = placeDeferrals.filter((d) => d.applianceId === id);
  const obligationCompletionsByTaskId = new Map<string, typeof obligationCompletions>();
  for (const entry of obligationCompletions) {
    const list = obligationCompletionsByTaskId.get(entry.maintenanceTaskId);
    if (list) list.push(entry);
    else obligationCompletionsByTaskId.set(entry.maintenanceTaskId, [entry]);
  }

  const guidance = applyDeferrals(
    filterPendingGuidance(getMaintenanceGuidanceForAppliances([appliance], place.maintenanceLevel), completions),
    [appliance],
    place.maintenanceLevel,
    deferrals,
    month
  );
  const deferralByTask = new Map(deferrals.map((d) => [d.maintenanceTaskId, d]));
  const deferrableTaskKeys = new Set(
    guidance
      .filter(({ task }) => canDeferMaintenanceTask(task, deferralByTask.get(task.id) ?? null, month))
      .map(({ task }) => task.id)
  );
  const pendingTaskIds = new Set(guidance.map(({ task }) => task.id));
  const upcoming = getUpcomingApplianceTasks(appliance, place.maintenanceLevel, latestCompletions, pendingTaskIds, month);
  const routines = appliance.equipmentTypeId
    ? getRoutineMaintenanceTasks(appliance.equipmentTypeId).filter((t) => isTaskIncludedAtLevel(t.level, place.maintenanceLevel))
    : [];

  const currentLevelTaskCount = appliance.equipmentTypeId
    ? countMaintenanceTasksAtLevel(appliance.equipmentTypeId, place.maintenanceLevel)
    : 0;
  const upgradeTaskCount =
    appliance.equipmentTypeId && currentLevelTaskCount === 0 && place.maintenanceLevel !== MAX_MAINTENANCE_LEVEL
      ? countMaintenanceTasksAtLevel(appliance.equipmentTypeId, MAX_MAINTENANCE_LEVEL)
      : 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/places/${appliance.placeId}`}
              className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              ← Retour
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
              {getApplianceDisplayName(appliance)}
            </h1>
          </div>
          <DeleteApplianceButton
            id={appliance.id}
            confirmMessage={`Supprimer « ${getApplianceDisplayName(appliance)} » ? Ses obligations et rappels seront supprimés avec.`}
            redirectTo={`/places/${appliance.placeId}`}
          />
        </header>

        <ObligationsBlock
          appliances={[appliance]}
          obligationRecords={obligationRecords}
          placeChecks={[]}
          completionsByTaskId={obligationCompletionsByTaskId}
        />

        <ApplianceEntretienSection
          applianceId={appliance.id}
          placeId={appliance.placeId}
          pending={guidance}
          upcoming={upcoming}
          deferrableTaskKeys={deferrableTaskKeys}
          upgradeTaskCount={upgradeTaskCount || undefined}
          upgradeLevelLabel={upgradeTaskCount > 0 ? MAINTENANCE_LEVEL_LABELS[MAX_MAINTENANCE_LEVEL] : undefined}
        />

        <ApplianceRoutinesSection applianceId={appliance.id} routines={routines} />

        <ApplianceEditForm appliance={appliance} action={updateAppliance.bind(null, appliance.id)} />
      </main>
    </div>
  );
}
