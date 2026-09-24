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

// REGLE-01's graded answer to "date du dernier passage" when there is no exact date:
// 'recent' (fait recemment, sans date exacte), 'old' (plus ancien que le delai legal),
// 'never' (jamais fait ou je ne sais pas).
export type ServiceConfidence = "recent" | "old" | "never" | null;

export type ApplianceObligationRecord = {
  applianceId: string;
  maintenanceTaskId: string;
  lastServiceDate: string | null;
  knownDueDate: string | null;
  serviceConfidence: ServiceConfidence;
};

export type ObligationView = {
  task: MaintenanceTask;
  status: ObligationStatus;
  dueDate: string | null;
  // REGLE-01: "jamais realise ou je ne sais pas" sorts ahead of other overdue rows.
  priority: boolean;
  legalObligations: LegalObligation[];
};

// Due dates are calendar dates with no time component; comparing them against a UTC
// "today" would be off by up to two hours around midnight for users in France.
export function getTodayInFrance(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

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
): { status: ObligationStatus; dueDate: string | null; priority: boolean } {
  if (equipmentType.legalStatus === "conditional") {
    return { status: "to_confirm", dueDate: null, priority: false };
  }
  if (record?.knownDueDate) {
    return {
      status: record.knownDueDate < today ? "overdue" : "up_to_date",
      dueDate: record.knownDueDate,
      priority: false,
    };
  }
  if (record?.serviceConfidence === "recent") {
    return { status: "to_confirm", dueDate: null, priority: false };
  }
  if (record?.serviceConfidence === "old") {
    return { status: "overdue", dueDate: null, priority: false };
  }
  if (record?.serviceConfidence === "never") {
    return { status: "overdue", dueDate: null, priority: true };
  }
  if (!record?.lastServiceDate) {
    return { status: "to_schedule", dueDate: null, priority: false };
  }
  const dueDate = addMonths(record.lastServiceDate, task.frequency.months);
  return { status: dueDate < today ? "overdue" : "up_to_date", dueDate, priority: false };
}

export function getObligationsForAppliance(
  equipmentTypeId: string,
  records: ApplianceObligationRecord[],
  today: string = getTodayInFrance()
): ObligationView[] {
  const tasks = getTrackedLegalTasks(equipmentTypeId);
  const equipmentType = getEquipmentType(equipmentTypeId);
  if (!equipmentType) return [];

  return tasks.map((task) => {
    const record = records.find((r) => r.maintenanceTaskId === task.id);
    const { status, dueDate, priority } = computeStatusAndDueDate(equipmentType, task, record, today);
    return {
      task,
      status,
      dueDate,
      priority,
      legalObligations: getLegalObligationsForType(equipmentTypeId),
    };
  });
}

// Home screen: "obligations first, sorted by urgency" — overdue before to-confirm
// before to-schedule before up-to-date, and within overdue, REGLE-01's "jamais
// realise ou je ne sais pas" rows first.
const STATUS_URGENCY: Record<ObligationStatus, number> = {
  overdue: 0,
  to_confirm: 1,
  to_schedule: 2,
  up_to_date: 3,
};

export function compareObligationsByUrgency(a: ObligationView, b: ObligationView): number {
  const rank = STATUS_URGENCY[a.status] - STATUS_URGENCY[b.status];
  if (rank !== 0) return rank;
  return Number(b.priority) - Number(a.priority);
}

// Compliance banner: "2 en retard, 1 a confirmer, 4 a jour" — only these three statuses
// count as evaluated; "a planifier" (no data at all, e.g. a manually added appliance)
// isn't part of the compliance picture yet.
export type ObligationCounts = { overdue: number; toConfirm: number; upToDate: number };

export function countObligationsByStatus(obligations: ObligationView[]): ObligationCounts {
  const counts: ObligationCounts = { overdue: 0, toConfirm: 0, upToDate: 0 };
  for (const o of obligations) {
    if (o.status === "overdue") counts.overdue += 1;
    else if (o.status === "to_confirm") counts.toConfirm += 1;
    else if (o.status === "up_to_date") counts.upToDate += 1;
  }
  return counts;
}

export { getMaintenanceTask };
