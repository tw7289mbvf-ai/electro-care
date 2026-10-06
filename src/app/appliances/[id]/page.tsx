import { notFound } from "next/navigation";
import { ApplianceDetailsSection } from "@/components/ApplianceDetailsSection";
import { ApplianceIconTile, BackLink, PAGE_CLASS, PAGE_TITLE_CLASS } from "@/components/ui";
import { DeleteApplianceButton } from "@/components/DeleteApplianceButton";
import { ObligationsBlock } from "@/components/ObligationsBlock";
import { ApplianceEntretienSection } from "@/components/ApplianceEntretienSection";
import { ApplianceRoutinesSection } from "@/components/ApplianceRoutinesSection";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import { getAppliance } from "@/lib/appliances";
import { getPlace } from "@/lib/places";
import { getObligationRecordsForAppliance } from "@/lib/appliance-obligations";
import { getObligationCompletionsForAppliance } from "@/lib/obligation-completions";
import { getAppointmentsForAppliance } from "@/lib/obligation-appointments";
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
  const [obligationRecords, obligationCompletions, appointments, placeCompletions, placeDeferrals, latestCompletions] =
    await Promise.all([
      getObligationRecordsForAppliance(id),
      getObligationCompletionsForAppliance(id),
      getAppointmentsForAppliance(id),
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

  const subtitle = [appliance.brand, appliance.model].filter(Boolean).join(" ");

  return (
    <main className={PAGE_CLASS}>
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <BackLink href={`/places/${appliance.placeId}`}>{place.name}</BackLink>
          <DeleteApplianceButton
            id={appliance.id}
            confirmMessage={`Supprimer « ${getApplianceDisplayName(appliance)} » ? Ses obligations et rappels seront supprimés avec.`}
            redirectTo={`/places/${appliance.placeId}`}
          />
        </div>
        <div className="flex items-center gap-4">
          <ApplianceIconTile appliance={appliance} large />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className={PAGE_TITLE_CLASS}>{getApplianceDisplayName(appliance)}</h1>
            {subtitle && <p className="text-[15px] text-ink-2">{subtitle}</p>}
          </div>
        </div>
      </header>

      <ObligationsBlock
        appliances={[appliance]}
        obligationRecords={obligationRecords}
        appointments={appointments}
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

      <ApplianceDetailsSection appliance={appliance} action={updateAppliance.bind(null, appliance.id)} />
    </main>
  );
}
