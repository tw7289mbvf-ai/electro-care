import type { EquipmentType } from "@/lib/equipment-types";
import { getEquipmentType } from "@/lib/equipment-types";
import { getMaintenanceTask, getTrackedLegalTasks, type MaintenanceTask } from "@/lib/maintenance-tasks";
import { getLegalObligationsForType, type LegalObligation } from "@/lib/legal-obligations";

// "not_applicable" (spec's "Actions and colours"): a power-conditional obligation
// (climatisation fixe, PAC air-air, chauffe-eau thermodynamique, PAC piscine) whose
// appliance is below the 4 kW threshold — grey, and left out of the compliance count,
// same as "to_schedule".
export type ObligationStatus = "up_to_date" | "to_schedule" | "overdue" | "to_confirm" | "not_applicable";

export const OBLIGATION_STATUS_LABELS: Record<ObligationStatus, string> = {
  up_to_date: "À jour",
  to_schedule: "À planifier",
  overdue: "En retard",
  to_confirm: "À confirmer",
  not_applicable: "Non concerné",
};

// Below this, a conditional obligation (climatisation fixe, PAC air-air, chauffe-eau
// thermodynamique, PAC piscine) doesn't apply at all (spec's "Actions and colours").
export const CONDITIONAL_POWER_THRESHOLD_KW = 4;

// REGLE-01's graded answer to a date question when there is no exact date: 'recent'
// (fait recemment / date inconnue, a confirmer), 'old' (plus ancien que le delai, ou une
// obligation connue non tenue, e.g. un puits non declare), 'never' (jamais fait ou je ne
// sais pas), 'compliant' (verifie conforme sans date, e.g. un puits declare).
export type ServiceConfidence = "recent" | "old" | "never" | "compliant" | null;

export type ApplianceObligationRecord = {
  applianceId: string;
  maintenanceTaskId: string;
  lastServiceDate: string | null;
  knownDueDate: string | null;
  serviceConfidence: ServiceConfidence;
  providerName: string | null;
  providerContact: string | null;
};

export type ObligationView = {
  task: MaintenanceTask;
  status: ObligationStatus;
  dueDate: string | null;
  // REGLE-01: "jamais realise ou je ne sais pas" sorts ahead of other overdue rows.
  priority: boolean;
  // Spec "Actions by status": an orange row updates either a date or the power/threshold
  // — this says which, so the button can route to the right place. Null otherwise.
  toConfirmReason: "date" | "threshold" | null;
  legalObligations: LegalObligation[];
  // "Fait en {mois} par {prestataire}" (spec's "Managing Appliances"): only set when the
  // status comes from an actual recorded service (last_service_date), never from a fixed
  // known_due_date or a REGLE-01 confidence grade — those aren't "an intervention we did".
  completedOn: string | null;
  providerName: string | null;
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
  today: string,
  powerKw: number | null
): {
  status: ObligationStatus;
  dueDate: string | null;
  priority: boolean;
  toConfirmReason: "date" | "threshold" | null;
  completedOn: string | null;
  providerName: string | null;
} {
  // Power known: below the threshold the obligation doesn't apply at all; at or above
  // it, the appliance is treated exactly like a legalStatus "yes" one from here on
  // (falls through to the checks below instead of returning).
  if (equipmentType.legalStatus === "conditional") {
    if (powerKw === null) {
      return { status: "to_confirm", dueDate: null, priority: false, toConfirmReason: "threshold", completedOn: null, providerName: null };
    }
    if (powerKw < CONDITIONAL_POWER_THRESHOLD_KW) {
      return { status: "not_applicable", dueDate: null, priority: false, toConfirmReason: null, completedOn: null, providerName: null };
    }
  }
  if (record?.knownDueDate) {
    return {
      status: record.knownDueDate < today ? "overdue" : "up_to_date",
      dueDate: record.knownDueDate,
      priority: false,
      toConfirmReason: null,
      completedOn: null,
      providerName: null,
    };
  }
  if (record?.serviceConfidence === "compliant") {
    return { status: "up_to_date", dueDate: null, priority: false, toConfirmReason: null, completedOn: null, providerName: null };
  }
  if (record?.serviceConfidence === "recent") {
    return { status: "to_confirm", dueDate: null, priority: false, toConfirmReason: "date", completedOn: null, providerName: null };
  }
  if (record?.serviceConfidence === "old") {
    return { status: "overdue", dueDate: null, priority: false, toConfirmReason: null, completedOn: null, providerName: null };
  }
  if (record?.serviceConfidence === "never") {
    return { status: "overdue", dueDate: null, priority: true, toConfirmReason: null, completedOn: null, providerName: null };
  }
  if (!record?.lastServiceDate) {
    return { status: "to_schedule", dueDate: null, priority: false, toConfirmReason: null, completedOn: null, providerName: null };
  }
  const dueDate = addMonths(record.lastServiceDate, task.frequency.months);
  return {
    status: dueDate < today ? "overdue" : "up_to_date",
    dueDate,
    priority: false,
    toConfirmReason: null,
    completedOn: record.lastServiceDate,
    providerName: record.providerName,
  };
}

export function getObligationsForAppliance(
  equipmentTypeId: string,
  records: ApplianceObligationRecord[],
  powerKw: number | null = null,
  today: string = getTodayInFrance()
): ObligationView[] {
  const tasks = getTrackedLegalTasks(equipmentTypeId);
  const equipmentType = getEquipmentType(equipmentTypeId);
  if (!equipmentType) return [];

  return tasks.map((task) => {
    const record = records.find((r) => r.maintenanceTaskId === task.id);
    const { status, dueDate, priority, toConfirmReason, completedOn, providerName } = computeStatusAndDueDate(
      equipmentType,
      task,
      record,
      today,
      powerKw
    );
    return {
      task,
      status,
      dueDate,
      priority,
      toConfirmReason,
      completedOn,
      providerName,
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
  not_applicable: 3,
  up_to_date: 4,
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

// Dashboard and place cards: total status counts across a set of appliances, e.g. one
// place's or every place's. An appliance with no equipment_type_id has no tracked
// obligations and is skipped, same as countObligationsByStatus's caller does elsewhere.
export function getObligationCountsForAppliances(
  appliances: { id: string; equipmentTypeId: string | null; powerKw: number | null }[],
  obligationRecords: ApplianceObligationRecord[],
  today: string = getTodayInFrance()
): ObligationCounts {
  const counts: ObligationCounts = { overdue: 0, toConfirm: 0, upToDate: 0 };
  for (const appliance of appliances) {
    if (!appliance.equipmentTypeId) continue;
    const records = obligationRecords.filter((r) => r.applianceId === appliance.id);
    const c = countObligationsByStatus(
      getObligationsForAppliance(appliance.equipmentTypeId, records, appliance.powerKw, today)
    );
    counts.overdue += c.overdue;
    counts.toConfirm += c.toConfirm;
    counts.upToDate += c.upToDate;
  }
  return counts;
}

export { getMaintenanceTask };
