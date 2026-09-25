import type { Appliance } from "@/lib/appliance-types";
import { getLifespanMaintenanceTasks, isTaskDueInMonth, type MaintenanceTask } from "@/lib/maintenance-tasks";
import { getCurrentMonthInFrance } from "@/lib/french-dates";
import type { MaintenanceCompletion } from "@/lib/maintenance-completions";

export type MaintenanceGuidanceItem = { appliance: Appliance; task: MaintenanceTask };

// "Entretien" section: non-legal maintenance tasks (getLifespanMaintenanceTasks already
// excludes legal obligations and routines more frequent than monthly) due this month per
// their season_months window.
export function getMaintenanceGuidanceForAppliances(
  appliances: Appliance[],
  month: number = getCurrentMonthInFrance()
): MaintenanceGuidanceItem[] {
  return appliances.flatMap((appliance) => {
    if (!appliance.equipmentTypeId) return [];
    return getLifespanMaintenanceTasks(appliance.equipmentTypeId)
      .filter((task) => isTaskDueInMonth(task, month))
      .map((task) => ({ appliance, task }));
  });
}

export function filterPendingGuidance(
  items: MaintenanceGuidanceItem[],
  completions: MaintenanceCompletion[]
): MaintenanceGuidanceItem[] {
  const done = new Set(completions.map((c) => `${c.applianceId}:${c.maintenanceTaskId}`));
  return items.filter((item) => !done.has(`${item.appliance.id}:${item.task.id}`));
}
