import maintenanceTasksSeed from "../../seed/maintenance_tasks.json";
import { getDateQuestionForTask } from "@/lib/date-questions";

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
// legal task whose seed/date_questions.json entry isn't "not_generated" (e.g. CH-07's
// 6-monthly second ramonage, which only applies past a usage measurement the app doesn't
// track). date_questions.json is the authoritative list — see REGLE-01/REGLE-06.
export function getTrackedLegalTasks(equipmentTypeId: string): MaintenanceTask[] {
  return ALL_TASKS.filter(
    (t) => t.equipmentTypeId === equipmentTypeId && t.legal === "yes" && getDateQuestionForTask(t.id)?.kind !== "not_generated"
  );
}
