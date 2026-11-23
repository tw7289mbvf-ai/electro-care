import type { EquipmentType } from "@/lib/equipment-types";
import { getEquipmentType } from "@/lib/equipment-types";
import { getMaintenanceTask, getTrackedLegalTasks, type MaintenanceTask } from "@/lib/maintenance-tasks";
import { getLegalObligationsForType, type LegalObligation } from "@/lib/legal-obligations";
import { getDateQuestionForTask } from "@/lib/date-questions";

// "not_applicable" (spec's "Actions and colours"): a power-conditional obligation
// (climatisation fixe, PAC air-air, chauffe-eau thermodynamique, PAC piscine) whose
// appliance is below the 4 kW threshold, or an answer that rules the obligation out (the
// gas hose on a rigid connection) — grey, and left out of the compliance count.
// "to_schedule" (« À planifier », decided 2026-11-23): the deadline falls this month.
// Dates are kept to the month, so an obligation is never red during its due month; it
// turns "overdue" on the first day of the following month. Orange, in the gauge.
export type ObligationStatus = "up_to_date" | "to_schedule" | "overdue" | "to_confirm" | "not_applicable";

// A monitored detector's follow-up (T-157): green with its own wording rather than "À jour".
export const MONITORED_STATUS_LABEL = "Suivi par votre télésurveillance";

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
// sais pas), 'compliant' (verifie conforme sans date, e.g. un puits declare, ou un
// flexible gaz metallique sans date limite), 'not_applicable' (l'obligation ne concerne
// pas cet appareil, e.g. un raccordement gaz rigide sans flexible).
export type ServiceConfidence = "recent" | "old" | "never" | "compliant" | "not_applicable" | null;

export type ApplianceObligationRecord = {
  applianceId: string;
  maintenanceTaskId: string;
  lastServiceDate: string | null;
  knownDueDate: string | null;
  serviceConfidence: ServiceConfidence;
  providerName: string | null;
  providerContact: string | null;
  modifiedAt: string | null;
};

export type ObligationView = {
  task: MaintenanceTask;
  status: ObligationStatus;
  // Replaces the status's own label when set (MONITORED_STATUS_LABEL).
  statusLabel: string | null;
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
  providerContact: string | null;
  // "modifiée le …" (spec's "Managing Appliances"): set only once someone edits this
  // recorded intervention, never on the original "C'est fait"/"Mettre à jour" answer.
  modifiedAt: string | null;
  // « Sans date limite »: an expiry-dated obligation answered "compliant" (the metal gas
  // hose, T-060) is up to date with no deadline at all, and the row says so instead of
  // showing a next due date.
  noDeadline: boolean;
};

// Due dates are calendar dates with no time component; comparing them against a UTC
// "today" would be off by up to two hours around midnight for users in France.
export function getTodayInFrance(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

// Exported for maintenance-guidance.ts's "Réalisé" next-date computation, which needs
// the same "last date + frequency" arithmetic as a legal obligation's due date.
export function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1 + Math.round(months), day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Dates are kept to the month (spec "Obligations and Maintenance"): a due date in the
// current month is « À planifier », one in an earlier month « En retard », a later one
// « À jour ». Compared on "YYYY-MM", never on the day.
export function statusForDueDate(dueDate: string, today: string): "up_to_date" | "to_schedule" | "overdue" {
  const dueMonth = dueDate.slice(0, 7);
  const thisMonth = today.slice(0, 7);
  if (dueMonth < thisMonth) return "overdue";
  if (dueMonth === thisMonth) return "to_schedule";
  return "up_to_date";
}

// « En retard depuis <mois> »: an obligation due in November is late from the first day
// of December, so the month shown is the one after the due month.
export function overdueSinceMonth(dueDate: string): string {
  return addMonths(dueDate, 1);
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
  providerContact: string | null;
  modifiedAt: string | null;
  noDeadline: boolean;
} {
  const none = { completedOn: null, providerName: null, providerContact: null, modifiedAt: null, noDeadline: false };
  // Followed by a monitoring provider: green whatever the dates, the provider's recorded
  // visits only feed the "Fait en … par …" line and the history.
  if (getDateQuestionForTask(task.id)?.kind === "monitored") {
    return {
      status: "up_to_date",
      dueDate: null,
      priority: false,
      toConfirmReason: null,
      completedOn: record?.lastServiceDate ?? null,
      providerName: record?.lastServiceDate ? record.providerName : null,
      providerContact: record?.lastServiceDate ? record.providerContact : null,
      modifiedAt: record?.lastServiceDate ? record.modifiedAt : null,
      noDeadline: false,
    };
  }
  // Power known: below the threshold the obligation doesn't apply at all; at or above
  // it, the appliance is treated exactly like a legalStatus "yes" one from here on
  // (falls through to the checks below instead of returning).
  if (equipmentType.legalStatus === "conditional") {
    if (powerKw === null) {
      return { status: "to_confirm", dueDate: null, priority: false, toConfirmReason: "threshold", ...none };
    }
    if (powerKw < CONDITIONAL_POWER_THRESHOLD_KW) {
      return { status: "not_applicable", dueDate: null, priority: false, toConfirmReason: null, ...none };
    }
  }
  if (record?.knownDueDate) {
    return {
      status: statusForDueDate(record.knownDueDate, today),
      dueDate: record.knownDueDate,
      priority: false,
      toConfirmReason: null,
      ...none,
    };
  }
  // The answer rules the obligation out for this appliance (e.g. T-060 on a rigid gas
  // connection): same grey, same exclusion from the count as the power threshold.
  // toConfirmReason "date" lets the fiche offer « Mettre à jour » to change the answer.
  if (record?.serviceConfidence === "not_applicable") {
    return { status: "not_applicable", dueDate: null, priority: false, toConfirmReason: "date", ...none };
  }
  if (record?.serviceConfidence === "compliant") {
    return {
      status: "up_to_date",
      dueDate: null,
      priority: false,
      toConfirmReason: null,
      ...none,
      noDeadline: getDateQuestionForTask(task.id)?.kind === "expiry_date",
    };
  }
  if (record?.serviceConfidence === "recent") {
    return { status: "to_confirm", dueDate: null, priority: false, toConfirmReason: "date", ...none };
  }
  if (record?.serviceConfidence === "old") {
    return { status: "overdue", dueDate: null, priority: false, toConfirmReason: null, ...none };
  }
  if (record?.serviceConfidence === "never") {
    return { status: "overdue", dueDate: null, priority: true, toConfirmReason: null, ...none };
  }
  // No answer at all (e.g. an appliance added by hand, never asked its date question):
  // « À confirmer », with « Mettre à jour » opening the question (decided 2026-11-23).
  if (!record?.lastServiceDate) {
    return { status: "to_confirm", dueDate: null, priority: false, toConfirmReason: "date", ...none };
  }
  const dueDate = addMonths(record.lastServiceDate, task.frequency.months);
  return {
    status: statusForDueDate(dueDate, today),
    dueDate,
    priority: false,
    toConfirmReason: null,
    completedOn: record.lastServiceDate,
    providerName: record.providerName,
    providerContact: record.providerContact,
    modifiedAt: record.modifiedAt,
    noDeadline: false,
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
    const { status, dueDate, priority, toConfirmReason, completedOn, providerName, providerContact, modifiedAt, noDeadline } =
      computeStatusAndDueDate(equipmentType, task, record, today, powerKw);
    return {
      task,
      status,
      statusLabel: getDateQuestionForTask(task.id)?.kind === "monitored" ? MONITORED_STATUS_LABEL : null,
      dueDate,
      priority,
      toConfirmReason,
      completedOn,
      providerName,
      providerContact,
      modifiedAt,
      noDeadline,
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

// Compliance gauge: red, orange, green. The orange count (toConfirm) covers both orange
// statuses, « À confirmer » and « À planifier » (spec: "All three count in the orange
// segment of the gauge"); only "not_applicable" stays out of the picture.
export type ObligationCounts = { overdue: number; toConfirm: number; upToDate: number };

export function countObligationsByStatus(obligations: ObligationView[]): ObligationCounts {
  const counts: ObligationCounts = { overdue: 0, toConfirm: 0, upToDate: 0 };
  for (const o of obligations) {
    if (o.status === "overdue") counts.overdue += 1;
    else if (o.status === "to_confirm" || o.status === "to_schedule") counts.toConfirm += 1;
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
