import type { EquipmentType } from "@/lib/equipment-types";
import { getEquipmentType } from "@/lib/equipment-types";
import { getMaintenanceTask, getTrackedLegalTasks, type MaintenanceTask } from "@/lib/maintenance-tasks";
import { getLegalObligationsForType, type LegalObligation } from "@/lib/legal-obligations";

export type ObligationStatus = "up_to_date" | "to_schedule" | "overdue" | "to_confirm";

export const OBLIGATION_STATUS_LABELS: Record<ObligationStatus, string> = {
  up_to_date: "À jour",
  to_schedule: "À planifier",
  overdue: "En retard",
  to_confirm: "À confirmer",
};

export type ApplianceObligationRecord = {
  applianceId: string;
  maintenanceTaskId: string;
  lastServiceDate: string | null;
  knownDueDate: string | null;
};

export type ObligationView = {
  task: MaintenanceTask;
  status: ObligationStatus;
  dueDate: string | null;
  legalObligations: LegalObligation[];
};

function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1 + Math.round(months), day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function computeStatusAndDueDate(
  equipmentType: EquipmentType,
  task: MaintenanceTask,
  record: ApplianceObligationRecord | undefined,
  today: string
): { status: ObligationStatus; dueDate: string | null } {
  if (equipmentType.legalStatus === "conditional") {
    return { status: "to_confirm", dueDate: null };
  }
  if (record?.knownDueDate) {
    return { status: record.knownDueDate < today ? "overdue" : "up_to_date", dueDate: record.knownDueDate };
  }
  if (!record?.lastServiceDate) {
    return { status: "to_schedule", dueDate: null };
  }
  const dueDate = addMonths(record.lastServiceDate, task.frequency.months);
  return { status: dueDate < today ? "overdue" : "up_to_date", dueDate };
}

export function getObligationsForAppliance(
  equipmentTypeId: string,
  records: ApplianceObligationRecord[],
  today: string = new Date().toISOString().slice(0, 10)
): ObligationView[] {
  const tasks = getTrackedLegalTasks(equipmentTypeId);
  const equipmentType = getEquipmentType(equipmentTypeId);
  if (!equipmentType) return [];

  return tasks.map((task) => {
    const record = records.find((r) => r.maintenanceTaskId === task.id);
    const { status, dueDate } = computeStatusAndDueDate(equipmentType, task, record, today);
    return {
      task,
      status,
      dueDate,
      legalObligations: getLegalObligationsForType(equipmentTypeId),
    };
  });
}

export { getMaintenanceTask };
