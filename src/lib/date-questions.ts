import dateQuestionsSeed from "../../seed/date_questions.json";
import maintenanceTasksSeed from "../../seed/maintenance_tasks.json";

export type DateQuestionKind =
  | "graded_month"
  | "expiry_date"
  | "manufacture_date"
  | "vehicle_inspection"
  | "yes_no"
  | "none"
  | "not_generated";

export type DateQuestion = {
  key: string;
  taskIds: string[];
  appliance: string;
  question: string | null;
  kind: DateQuestionKind;
  intervalLabel: string | null;
  note: string | null;
};

export const DATE_QUESTIONS: DateQuestion[] = dateQuestionsSeed.map((d) => ({
  key: d.key,
  taskIds: d.tasks,
  appliance: d.appliance,
  question: d.question,
  kind: d.kind as DateQuestionKind,
  intervalLabel: d.interval_label,
  note: d.note,
}));

// Every legal task has exactly one single-task entry (seed/date_questions.json is the
// authoritative list of which legal tasks are tracked — see REGLE-01/REGLE-06 — and how
// each is asked about).
const SINGLE_BY_TASK_ID = new Map(
  DATE_QUESTIONS.filter((d) => d.taskIds.length === 1).map((d) => [d.taskIds[0], d])
);

// REGLE-03 combos (e.g. "T-001+T-014"), keyed by their sorted task ids so lookup doesn't
// depend on the order two pending tasks happen to be discovered in.
const COMBO_BY_TASK_IDS = new Map(
  DATE_QUESTIONS.filter((d) => d.taskIds.length > 1).map((d) => [[...d.taskIds].sort().join("+"), d])
);

export function getDateQuestionForTask(taskId: string): DateQuestion | undefined {
  return SINGLE_BY_TASK_ID.get(taskId);
}

export function getCombinedDateQuestion(taskIdA: string, taskIdB: string): DateQuestion | undefined {
  return COMBO_BY_TASK_IDS.get([taskIdA, taskIdB].sort().join("+"));
}

const EQUIPMENT_TYPE_BY_TASK_ID = new Map(maintenanceTasksSeed.map((t) => [t.id, t.equipment_type_id]));

// A proofread, display-ready appliance name for a legal-task-bearing equipment type —
// used to name the appliance in a follow-up question (spec: "every question ... states
// which appliance it is about"). Equipment types with no legal task (most of the
// maintenance-only checklist) aren't covered; callers fall back to the raw seed label.
const APPLIANCE_LABEL_BY_EQUIPMENT_TYPE = new Map(
  DATE_QUESTIONS.filter((d) => d.taskIds.length === 1).map((d) => [
    EQUIPMENT_TYPE_BY_TASK_ID.get(d.taskIds[0]),
    d.appliance,
  ])
);

export function getApplianceLabelForEquipmentType(equipmentTypeId: string): string | undefined {
  return APPLIANCE_LABEL_BY_EQUIPMENT_TYPE.get(equipmentTypeId);
}
