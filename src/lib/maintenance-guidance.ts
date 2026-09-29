import type { Appliance } from "@/lib/appliance-types";
import { getLifespanMaintenanceTasks, getMaintenanceTask, isTaskDueInMonth, type MaintenanceTask } from "@/lib/maintenance-tasks";
import { isTaskIncludedAtLevel, type MaintenanceLevel } from "@/lib/maintenance-levels";
import { getCurrentMonthInFrance, addMonthsToKey, monthsBetweenKeys } from "@/lib/french-dates";
import { addMonths } from "@/lib/obligations";
import type { MaintenanceCompletion } from "@/lib/maintenance-completions";
import type { MaintenanceDeferral } from "@/lib/maintenance-deferrals";

export type MaintenanceGuidanceItem = { appliance: Appliance; task: MaintenanceTask };

export type UpcomingMaintenanceItem = {
  task: MaintenanceTask;
  completion: MaintenanceCompletion | null;
  nextDate: string;
};

// The month (1-12) after `month`, wrapping into next year past December — used below to
// find a seasonal task's next occurrence, never the same month as "today" (a task not in
// "À faire" this month either isn't seasoned for it, or was just completed for it: either
// way its next occurrence is strictly later, not now).
function nextSeasonOccurrence(seasonMonths: number[], monthKey: string): string {
  // An all-year task (seasonMonths: []) is always "due" per isTaskDueInMonth, so a never-
  // completed one is always in "À faire" already — this branch is defensive, not a real
  // path, since Math.min(...[]) would otherwise be Infinity.
  if (seasonMonths.length === 0) return monthKey;
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const upcomingThisYear = seasonMonths.filter((m) => m > month);
  if (upcomingThisYear.length > 0) {
    return `${year}-${String(Math.min(...upcomingThisYear)).padStart(2, "0")}`;
  }
  return `${year + 1}-${String(Math.min(...seasonMonths)).padStart(2, "0")}`;
}

// Appliance fiche's "À venir" (spec's "Managing Appliances", revision 51): every lifespan
// task at the place's level not already in "À faire" (pendingTaskIds — this month's due-
// or-overdue set, same engine as the place page's "Entretien du mois", so the two never
// disagree), each shown exactly once. A task with a completion carries it plus its next
// date ("last date + frequency", the same arithmetic a legal obligation's due date uses);
// a task never completed at all — e.g. FROID-01's T-042, seasoned to April/October —
// carries no completion but still its next seasonal occurrence, so it stays visible
// instead of silently waiting for its window with no trace on the appliance's own fiche.
export function getUpcomingApplianceTasks(
  appliance: Appliance,
  level: MaintenanceLevel,
  latestCompletions: MaintenanceCompletion[],
  pendingTaskIds: Set<string>,
  monthKey: string
): UpcomingMaintenanceItem[] {
  if (!appliance.equipmentTypeId) return [];
  const completionByTask = new Map(latestCompletions.map((c) => [c.maintenanceTaskId, c]));
  return getLifespanMaintenanceTasks(appliance.equipmentTypeId)
    .filter((task) => isTaskIncludedAtLevel(task.level, level) && !pendingTaskIds.has(task.id))
    .map((task) => {
      const completion = completionByTask.get(task.id) ?? null;
      const nextDate = completion
        ? addMonths(`${completion.doneMonth}-01`, task.frequency.months)
        : nextSeasonOccurrence(task.seasonMonths, monthKey);
      return { task, completion, nextDate };
    });
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
