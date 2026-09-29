import type { Appliance } from "@/lib/appliance-types";
import { getLifespanMaintenanceTasks, getMaintenanceTask, isTaskDueInMonth, type MaintenanceTask } from "@/lib/maintenance-tasks";
import { isTaskIncludedAtLevel, type MaintenanceLevel } from "@/lib/maintenance-levels";
import { getCurrentMonthInFrance, addMonthsToKey, monthsBetweenKeys } from "@/lib/french-dates";
import { addMonths } from "@/lib/obligations";
import type { MaintenanceCompletion } from "@/lib/maintenance-completions";
import type { MaintenanceDeferral } from "@/lib/maintenance-deferrals";

export type MaintenanceGuidanceItem = { appliance: Appliance; task: MaintenanceTask };

export type RealisedMaintenanceItem = {
  task: MaintenanceTask;
  completion: MaintenanceCompletion;
  nextDate: string;
};

// "Réalisé" (spec's "Managing Appliances"): one appliance's lifespan tasks, at the
// place's level, that already have a completion and aren't in this month's "À faire"
// (pendingTaskIds) — the last completion plus the date it's next due, "last date +
// frequency", the same arithmetic a legal obligation's due date uses.
export function getRealisedMaintenanceForAppliance(
  appliance: Appliance,
  level: MaintenanceLevel,
  latestCompletions: MaintenanceCompletion[],
  pendingTaskIds: Set<string>
): RealisedMaintenanceItem[] {
  if (!appliance.equipmentTypeId) return [];
  const completionByTask = new Map(latestCompletions.map((c) => [c.maintenanceTaskId, c]));
  return getLifespanMaintenanceTasks(appliance.equipmentTypeId)
    .filter((task) => isTaskIncludedAtLevel(task.level, level) && !pendingTaskIds.has(task.id))
    .flatMap((task) => {
      const completion = completionByTask.get(task.id);
      if (!completion) return [];
      return [{ task, completion, nextDate: addMonths(`${completion.doneMonth}-01`, task.frequency.months) }];
    });
}

// Appliance fiche's "À faire", on top of getMaintenanceGuidanceForAppliances: a task
// that has never been completed at all, even outside its season_months window. The
// place's own monthly list stays scoped to this month's actionable items by design
// (spec's "Reminders": "timed by each task's frequency and the months it applies to"),
// but the fiche is the appliance's whole upkeep picture — a never-done essential task
// (e.g. FROID-01's T-042, seasoned to April/October) must not silently wait for its
// next window to even be visible, the way ObligationRow never hides a legal obligation
// just because its due date isn't close. A task that already has a completion is
// excluded here regardless of month: it belongs to "Réalisé" instead, which already
// computes its own next date and shows unconditionally of season.
export function getNeverCompletedApplianceTasks(
  appliance: Appliance,
  level: MaintenanceLevel,
  latestCompletions: MaintenanceCompletion[],
  alreadyPendingTaskIds: Set<string>
): MaintenanceGuidanceItem[] {
  if (!appliance.equipmentTypeId) return [];
  const completedTaskIds = new Set(latestCompletions.map((c) => c.maintenanceTaskId));
  return getLifespanMaintenanceTasks(appliance.equipmentTypeId)
    .filter(
      (task) =>
        isTaskIncludedAtLevel(task.level, level) &&
        !completedTaskIds.has(task.id) &&
        !alreadyPendingTaskIds.has(task.id)
    )
    .map((task) => ({ appliance, task }));
}

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
// 1) is always deferrable — spec "For a monthly task, postponing simply skips this
// month": next month's occurrence is due regardless, so skipping this one can't make it
// vanish for a full interval the way it could for a less frequent task.
export function canDeferMaintenanceTask(
  task: MaintenanceTask,
  deferral: MaintenanceDeferral | null,
  monthKey: string
): boolean {
  if (task.frequency.months <= 1) return true;
  const origin = deferral?.originMonth ?? monthKey;
  const maxShift = Math.round(task.frequency.months);
  const candidate = addMonthsToKey(monthKey, 1);
  return monthsBetweenKeys(origin, candidate) < maxShift;
}
