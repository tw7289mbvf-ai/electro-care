import maintenanceTasksSeed from "../../seed/maintenance_tasks.json";
import { getDateQuestionForTask } from "@/lib/date-questions";

export type MaintenanceTask = {
  id: string;
  equipmentTypeId: string;
  title: string;
  performer: "diy" | "pro";
  frequency: {
    rule: "every_n_months" | "season_anchor" | "threshold" | "per_use";
    months: number;
    label: string;
    threshold?: string;
  };
  // Months (1-12) the task applies to; [] = all year (seed/README.md "Key fields").
  seasonMonths: number[];
  procedure: string;
  tools: string;
  ifSkipped: string;
  legal: "yes" | "no";
};

export const PERFORMER_LABELS: Record<MaintenanceTask["performer"], string> = {
  diy: "À faire soi-même",
  pro: "Professionnel recommandé",
};

const ALL_TASKS: MaintenanceTask[] = maintenanceTasksSeed.map((t) => ({
  id: t.id,
  equipmentTypeId: t.equipment_type_id,
  title: t.title,
  performer: t.performer as MaintenanceTask["performer"],
  frequency: t.frequency as MaintenanceTask["frequency"],
  seasonMonths: t.season_months,
  procedure: t.procedure,
  tools: t.tools,
  ifSkipped: t.if_skipped,
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

// "Entretien" candidates for an equipment type: non-legal tasks (legal obligations are
// tracked separately, see getTrackedLegalTasks) at monthly frequency or slower. Anything
// more frequent than monthly (weekly, per use) stays a routine in the appliance card and
// never reaches the dashboard or the place page.
export function getLifespanMaintenanceTasks(equipmentTypeId: string): MaintenanceTask[] {
  return ALL_TASKS.filter((t) => t.equipmentTypeId === equipmentTypeId && t.legal !== "yes" && t.frequency.months >= 1);
}

export function isTaskDueInMonth(task: MaintenanceTask, month: number): boolean {
  return task.seasonMonths.length === 0 || task.seasonMonths.includes(month);
}
