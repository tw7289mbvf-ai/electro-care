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
  // Maintenance level of a non-legal task; null for legal obligations, tracked at
  // every level (seed/README.md "level").
  level: "essential" | "recommended" | null;
  // Hands-on minutes for the user, 0 when a professional does it (seed/README.md
  // "active_minutes").
  activeMinutes: number;
  // Shown instead of the legal obligation's risks on this task's row (e.g. T-158, the
  // CE EN 14604 check, whose stake is the insurer, not an undetected fire).
  risk: string | null;
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
  level: t.level as MaintenanceTask["level"],
  activeMinutes: t.active_minutes,
  risk: t.risk ?? null,
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

// "Routines" on the appliance card (spec's "Managing Appliances"): non-legal tasks more
// frequent than monthly (weekly, per use) — the complement of getLifespanMaintenanceTasks
// among non-legal tasks, informational only (no due date, no place-page guidance).
export function getRoutineMaintenanceTasks(equipmentTypeId: string): MaintenanceTask[] {
  return ALL_TASKS.filter((t) => t.equipmentTypeId === equipmentTypeId && t.legal !== "yes" && t.frequency.months < 1);
}

export function isTaskDueInMonth(task: MaintenanceTask, month: number): boolean {
  return task.seasonMonths.length === 0 || task.seasonMonths.includes(month);
}
