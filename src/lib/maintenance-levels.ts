import enumsSeed from "../../seed/enums.json";
import { getLifespanMaintenanceTasks, getRoutineMaintenanceTasks, type MaintenanceTask } from "@/lib/maintenance-tasks";

export const MAINTENANCE_LEVELS = enumsSeed.maintenance_level.map((l) => l.key) as [string, ...string[]];

export type MaintenanceLevel = (typeof MAINTENANCE_LEVELS)[number];

export const MAINTENANCE_LEVEL_LABELS: Record<MaintenanceLevel, string> = Object.fromEntries(
  enumsSeed.maintenance_level.map((l) => [l.key, l.label])
);

export const MAINTENANCE_LEVEL_DESCRIPTIONS: Record<MaintenanceLevel, string> = {
  none: "Uniquement les obligations légales.",
  essential: "Éviter les pannes et les dégâts.",
  recommended: "Faire aussi durer vos appareils et votre maison.",
};

const LEVEL_RANK: Record<MaintenanceLevel, number> = Object.fromEntries(
  MAINTENANCE_LEVELS.map((key, index) => [key, index])
);

// Each level includes every task of the levels before it (seed/README.md "level").
export function isTaskIncludedAtLevel(taskLevel: MaintenanceTask["level"], level: MaintenanceLevel): boolean {
  if (taskLevel === null) return false;
  return LEVEL_RANK[taskLevel] <= LEVEL_RANK[level];
}

// Hands-on time per month a level asks for, for one place: sum of active_minutes /
// frequency.months over the lifespan tasks (monthly or slower — legal obligations are
// tracked separately, at every level) included at that level, one contribution per
// appliance instance passed in (equipmentTypeIds is not deduplicated by this function).
export function estimateMaintenanceMinutesPerMonth(equipmentTypeIds: string[], level: MaintenanceLevel): number {
  let total = 0;
  for (const typeId of equipmentTypeIds) {
    for (const task of getLifespanMaintenanceTasks(typeId)) {
      if (isTaskIncludedAtLevel(task.level, level)) {
        total += task.activeMinutes / task.frequency.months;
      }
    }
  }
  return Math.round(total);
}

export function estimateMaintenanceMinutesForAllLevels(equipmentTypeIds: string[]): Record<MaintenanceLevel, number> {
  return Object.fromEntries(
    MAINTENANCE_LEVELS.map((level) => [level, estimateMaintenanceMinutesPerMonth(equipmentTypeIds, level)])
  ) as Record<MaintenanceLevel, number>;
}

export const MAX_MAINTENANCE_LEVEL: MaintenanceLevel = MAINTENANCE_LEVELS[MAINTENANCE_LEVELS.length - 1];

// Total "gestes d'entretien" (lifespan tasks + routines, legal obligations tracked
// separately) an equipment type carries at a level. Used by the appliance fiche's empty
// state (spec "Managing Appliances": "Aucun geste indispensable pour cet appareil.
// Passez au niveau Recommandé pour voir ses N gestes d'entretien.").
export function countMaintenanceTasksAtLevel(equipmentTypeId: string, level: MaintenanceLevel): number {
  const tasks = [...getLifespanMaintenanceTasks(equipmentTypeId), ...getRoutineMaintenanceTasks(equipmentTypeId)];
  return tasks.filter((t) => isTaskIncludedAtLevel(t.level, level)).length;
}
