import maintenanceTasksSeed from "../../seed/maintenance_tasks.json";

export type MaintenanceTask = {
  id: string;
  equipmentTypeId: string;
  title: string;
  performer: string;
  frequency: {
    rule: "every_n_months" | "season_anchor" | "threshold" | "per_use";
    months: number;
    label: string;
    threshold?: string;
  };
  legal: "yes" | "no";
};

const ALL_TASKS: MaintenanceTask[] = maintenanceTasksSeed.map((t) => ({
  id: t.id,
  equipmentTypeId: t.equipment_type_id,
  title: t.title,
  performer: t.performer,
  frequency: t.frequency as MaintenanceTask["frequency"],
  legal: t.legal as "yes" | "no",
}));

const TASKS_BY_ID = new Map(ALL_TASKS.map((t) => [t.id, t]));

export function getMaintenanceTask(id: string): MaintenanceTask | undefined {
  return TASKS_BY_ID.get(id);
}

// The legal tasks actually tracked as separate obligations for an equipment type: every
// legal task, except a "threshold" one when a non-threshold legal task also exists for
// the same type (e.g. CH-07's 6-monthly second ramonage on top of its annual one, or
// ASS-01's threshold pumping on top of its 10-year SPANC check) — those only apply past
// a usage measurement the app doesn't track, so they don't generate by default. A
// threshold task with no non-threshold sibling (CUIS-04's gas hose, VEH-01/02's technical
// inspection) is the only schedule available for that type, so it is tracked as-is.
export function getTrackedLegalTasks(equipmentTypeId: string): MaintenanceTask[] {
  const legalTasks = ALL_TASKS.filter((t) => t.equipmentTypeId === equipmentTypeId && t.legal === "yes");
  const hasNonThreshold = legalTasks.some((t) => t.frequency.rule !== "threshold");
  return hasNonThreshold ? legalTasks.filter((t) => t.frequency.rule !== "threshold") : legalTasks;
}
