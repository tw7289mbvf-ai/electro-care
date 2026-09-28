import type { Appliance } from "@/lib/appliance-types";
import { getLifespanMaintenanceTasks, getMaintenanceTask, isTaskDueInMonth, type MaintenanceTask } from "@/lib/maintenance-tasks";
import { isTaskIncludedAtLevel, type MaintenanceLevel } from "@/lib/maintenance-levels";
import { getCurrentMonthInFrance, addMonthsToKey, monthsBetweenKeys } from "@/lib/french-dates";
import type { MaintenanceCompletion } from "@/lib/maintenance-completions";
import type { MaintenanceDeferral } from "@/lib/maintenance-deferrals";

export type MaintenanceGuidanceItem = { appliance: Appliance; task: MaintenanceTask };

// "Entretien" section: non-legal maintenance tasks (getLifespanMaintenanceTasks already
// excludes legal obligations and routines more frequent than monthly) due this month per
// their season_months window, and included at the place's chosen maintenance level.
export function getMaintenanceGuidanceForAppliances(
  appliances: Appliance[],
  level: MaintenanceLevel,
  month: number = getCurrentMonthInFrance()
): MaintenanceGuidanceItem[] {
  return appliances.flatMap((appliance) => {
    if (!appliance.equipmentTypeId) return [];
    return getLifespanMaintenanceTasks(appliance.equipmentTypeId)
      .filter((task) => isTaskIncludedAtLevel(task.level, level) && isTaskDueInMonth(task, month))
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

function guidanceKey(applianceId: string, maintenanceTaskId: string): string {
  return `${applianceId}:${maintenanceTaskId}`;
}

// "Reporter": folds deferrals into this month's guidance — hides a task deferred to a
// later month, and pulls back in one deferred to this exact month even if its season
// window wouldn't naturally include it (an annual task deferred past its one due month
// would otherwise vanish from every list until next year).
export function applyDeferrals(
  items: MaintenanceGuidanceItem[],
  appliances: Appliance[],
  level: MaintenanceLevel,
  deferrals: MaintenanceDeferral[],
  monthKey: string
): MaintenanceGuidanceItem[] {
  const deferralByKey = new Map(deferrals.map((d) => [guidanceKey(d.applianceId, d.maintenanceTaskId), d]));
  const kept = items.filter((item) => {
    const d = deferralByKey.get(guidanceKey(item.appliance.id, item.task.id));
    return !d || d.deferredToMonth === monthKey;
  });
  const keptKeys = new Set(kept.map((i) => guidanceKey(i.appliance.id, i.task.id)));
  const applianceById = new Map(appliances.map((a) => [a.id, a]));
  const pulledIn: MaintenanceGuidanceItem[] = [];
  for (const d of deferrals) {
    if (d.deferredToMonth !== monthKey) continue;
    const key = guidanceKey(d.applianceId, d.maintenanceTaskId);
    if (keptKeys.has(key)) continue;
    const appliance = applianceById.get(d.applianceId);
    const task = getMaintenanceTask(d.maintenanceTaskId);
    if (!appliance || !task || !isTaskIncludedAtLevel(task.level, level)) continue;
    pulledIn.push({ appliance, task });
  }
  return [...kept, ...pulledIn];
}

// Whether "Reporter" may push this task one more month: never past a full interval
// away from where it was first due this cycle. A strictly monthly task (frequency.months
// 1) has no room to defer at all past its first push, since by then the next occurrence
// is already due anyway.
export function canDeferMaintenanceTask(
  task: MaintenanceTask,
  deferral: MaintenanceDeferral | null,
  monthKey: string
): boolean {
  const origin = deferral?.originMonth ?? monthKey;
  const maxShift = Math.max(1, Math.round(task.frequency.months));
  const candidate = addMonthsToKey(monthKey, 1);
  return monthsBetweenKeys(origin, candidate) < maxShift;
}
