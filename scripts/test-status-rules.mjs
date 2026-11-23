#!/usr/bin/env node
// Pure-logic checks of the rules decided on 2026-11-23 (spec "Obligations and
// Maintenance", "Managing Appliances", "Maintenance Guidance") — no DB, no Neon.
// Run with: node --experimental-strip-types scripts/test-status-rules.mjs
import { readFileSync } from "node:fs";
import { register } from "node:module";
register("./_ts_alias_loader.mjs", import.meta.url);

const { getObligationsForAppliance, countObligationsByStatus, statusForDueDate, overdueSinceMonth } = await import("@/lib/obligations");
const { getTrackedLegalTasks, getLifespanMaintenanceTasks, getMaintenanceTask } = await import("@/lib/maintenance-tasks");
const { getEquipmentType } = await import("@/lib/equipment-types");
const { getLegalObligationsForType } = await import("@/lib/legal-obligations");
const { getDateQuestionForTask } = await import("@/lib/date-questions");
const { milestoneTriggerDate } = await import("@/lib/reminder-milestones");
const { estimateMaintenanceMinutesPerMonth } = await import("@/lib/maintenance-levels");

const results = [];
function check(label, condition, detail) {
  results.push({ label, ok: Boolean(condition), detail });
  console.log(`${condition ? "OK  " : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
}

const TODAY = "2026-11-23";
const record = (fields) => ({
  applianceId: "a", maintenanceTaskId: "T-001", lastServiceDate: null, knownDueDate: null, serviceConfidence: null,
  providerName: null, providerContact: null, modifiedAt: null, ...fields,
});
const boiler = (fields) => getObligationsForAppliance("CH-01", [record(fields)], null, TODAY).find((v) => v.task.id === "T-001");

// --- A. « À planifier » during the due month, « En retard » from the next month ------
{
  const dueThisMonth = boiler({ lastServiceDate: "2025-11-01" });
  check("Annual service done November 2025 is « À planifier » in November 2026, not red", dueThisMonth.status === "to_schedule", dueThisMonth.status);
  check("Its due date is this month", dueThisMonth.dueDate === "2026-11-01", dueThisMonth.dueDate);
  const dueLastMonth = boiler({ lastServiceDate: "2025-10-01" });
  check("The same service one month earlier is « En retard »", dueLastMonth.status === "overdue", dueLastMonth.status);
  check("« En retard depuis » names the month after the due month", overdueSinceMonth(dueLastMonth.dueDate) === "2026-11-01", overdueSinceMonth(dueLastMonth.dueDate));
  check("Due next month is « À jour »", boiler({ lastServiceDate: "2025-12-01" }).status === "up_to_date");
  check("Last day of the due month is still « À planifier »", statusForDueDate("2026-11-01", "2026-11-30") === "to_schedule");
  check("First day of the following month turns it red", statusForDueDate("2026-11-01", "2026-12-01") === "overdue");
  check("A known due date this month is « À planifier » too", boiler({ knownDueDate: "2026-11-01" }).status === "to_schedule");
  const counts = countObligationsByStatus([dueThisMonth, dueLastMonth, boiler({ lastServiceDate: "2026-01-01" })]);
  check("Gauge: « À planifier » counts in the orange segment", counts.overdue === 1 && counts.toConfirm === 1 && counts.upToDate === 1, JSON.stringify(counts));
}

// --- Q3. No answer at all is « À confirmer » with the date question ----------------
{
  const none = getObligationsForAppliance("CH-01", [], null, TODAY).find((v) => v.task.id === "T-001");
  check("No record at all is « À confirmer »", none.status === "to_confirm", none.status);
  check("… and « Mettre à jour » opens the date question", none.toConfirmReason === "date", none.toConfirmReason);
  check("… counted in the orange segment", countObligationsByStatus([none]).toConfirm === 1);
}

// --- Reminders: due_date milestone at the start of the due month, overdue ones from the
// first day of the following month ------------------------------------------------
{
  check("Reminder « échéance » fires at the start of the due month", milestoneTriggerDate("2026-11-01", "due_date") === "2026-11-01");
  check("First « en retard » reminder fires on the 1st of the following month", milestoneTriggerDate("2026-11-01", "overdue_1") === "2026-12-01");
}

// --- B. « Rendez-vous pris » only on professional tasks ----------------------------
{
  const source = readFileSync(new URL("../src/components/AppointmentButton.tsx", import.meta.url), "utf8");
  check("AppointmentButton returns null when the task is not done by a professional", source.includes('if (performer !== "pro") return null;'));
  check("AppointmentButton accepts « À planifier »", source.includes('status !== "to_schedule"'));
  const diy = getTrackedLegalTasks("SEC-01").find((t) => t.id === "T-083");
  check("T-083 (detector replacement) is a do-it-yourself legal task", diy?.performer === "diy", diy?.performer);
  const row = readFileSync(new URL("../src/components/ObligationRow.tsx", import.meta.url), "utf8");
  check("ObligationRow passes the task's performer to the button", row.includes("performer={row.task.performer}"));
}

// --- C. Monthly checks are maintenance now -----------------------------------------
{
  for (const [taskId, typeId] of [["T-082", "SEC-01"], ["T-093", "PIS-01"], ["T-100", "PIS-07"], ["T-155", "SEC-08"]]) {
    const task = getMaintenanceTask(taskId);
    check(`${taskId} is an Essentiel maintenance task`, task?.legal === "no" && task.level === "essential", `${task?.legal} ${task?.level}`);
    check(`${taskId} is out of ${typeId}'s obligations`, !getTrackedLegalTasks(typeId).some((t) => t.id === taskId));
    check(`${taskId} is in ${typeId}'s monthly maintenance`, getLifespanMaintenanceTasks(typeId).some((t) => t.id === taskId));
  }
  const sec01 = getObligationsForAppliance("SEC-01", [record({ maintenanceTaskId: "T-082", lastServiceDate: "2025-01-01" })], null, TODAY);
  check("T-082 no longer enters the gauge", !sec01.some((v) => v.task.id === "T-082") && countObligationsByStatus(sec01).overdue === 0, sec01.map((v) => `${v.task.id}:${v.status}`).join(","));
  check("The smoke detector keeps its legal line (T-083)", getTrackedLegalTasks("SEC-01").map((t) => t.id).join(",") === "T-083");
  check("SEC-08 keeps a legal line", getTrackedLegalTasks("SEC-08").length >= 1, getTrackedLegalTasks("SEC-08").map((t) => t.id).join(","));
  check("SEC-09 keeps its legal lines", getTrackedLegalTasks("SEC-09").length >= 1, getTrackedLegalTasks("SEC-09").map((t) => t.id).join(","));
  const pool = getTrackedLegalTasks("PIS-01");
  check("The pool carries a single legal line, « Dispositif de sécurité en place »", pool.length === 1 && pool[0].id === "T-161" && pool[0].title === "Dispositif de sécurité en place", pool.map((t) => t.id).join(","));
  check("T-161 is a yes/no question", getDateQuestionForTask("T-161")?.kind === "yes_no");
  const noDevice = getObligationsForAppliance("PIS-01", [record({ maintenanceTaskId: "T-161", serviceConfidence: "never" })], null, TODAY)[0];
  check("« Sans dispositif » stays red", noDevice.status === "overdue" && noDevice.priority === true, noDevice.status);
  const withDevice = getObligationsForAppliance("PIS-01", [record({ maintenanceTaskId: "T-161", serviceConfidence: "compliant" })], null, TODAY)[0];
  check("« Protégée par … » is green", withDevice.status === "up_to_date", withDevice.status);
  check("PIS-07 is ordinary equipment: no legal status, no legal line", getEquipmentType("PIS-07")?.legalStatus === "no" && getTrackedLegalTasks("PIS-07").length === 0);
  check("L-08 points at the pool only", getLegalObligationsForType("PIS-01").some((o) => o.id === "L-08") && !getLegalObligationsForType("PIS-07").some((o) => o.id === "L-08"));
}

// --- D. Washing machine ------------------------------------------------------------
{
  check("T-047 opens on the missing-filter sentence", getMaintenanceTask("T-047")?.procedure.startsWith("Certains modèles n'ont pas de filtre accessible"));
  const t049 = getMaintenanceTask("T-049");
  check("T-049 is « Lavage d'entretien à vide », Essentiel, every 6 months", t049?.title === "Lavage d'entretien à vide" && t049.level === "essential" && t049.frequency.months === 6);
  const t159 = getMaintenanceTask("T-159");
  const t160 = getMaintenanceTask("T-160");
  check("T-159 « Nettoyage du bac à produits »: LAV-01, Recommandé, 3 months, 10 min", t159?.equipmentTypeId === "LAV-01" && t159.level === "recommended" && t159.frequency.months === 3 && t159.activeMinutes === 10);
  check("T-160 « Nettoyage du filtre d'arrivée d'eau »: LAV-01, Recommandé, 12 months, 15 min", t160?.equipmentTypeId === "LAV-01" && t160.level === "recommended" && t160.frequency.months === 12 && t160.activeMinutes === 15);
}

// --- E. Gas hose answers -----------------------------------------------------------
{
  const metal = getObligationsForAppliance("CUIS-04", [record({ maintenanceTaskId: "T-060", serviceConfidence: "compliant" })], null, TODAY)[0];
  check("Metal hose: « À jour », no deadline (« Sans date limite »)", metal.status === "up_to_date" && metal.dueDate === null && metal.noDeadline === true, metal.status);
  const rigid = getObligationsForAppliance("CUIS-04", [record({ maintenanceTaskId: "T-060", serviceConfidence: "not_applicable" })], null, TODAY)[0];
  check("Rigid connection: « Non concerné », out of the gauge", rigid.status === "not_applicable" && JSON.stringify(countObligationsByStatus([rigid])) === JSON.stringify({ overdue: 0, toConfirm: 0, upToDate: 0 }), rigid.status);
}

// --- F. « Mon appareil n'a pas cet élément » leaves the time estimate -------------------
{
  const full = estimateMaintenanceMinutesPerMonth(["LAV-01"], "essential");
  const without = estimateMaintenanceMinutesPerMonth([{ equipmentTypeId: "LAV-01", excludedTaskIds: new Set(["T-047"]) }], "essential");
  check("Excluding the drain filter lowers the Essentiel estimate", without < full, `${full} -> ${without} min`);
}

const failures = results.filter((r) => !r.ok);
console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f.label}${f.detail ? " — " + f.detail : ""}`);
  process.exit(1);
}
