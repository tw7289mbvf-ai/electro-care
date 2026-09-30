import { getAuthedContext } from "@/lib/db";

export type ObligationCompletion = {
  id: string;
  applianceId: string;
  maintenanceTaskId: string;
  serviceDate: string;
  providerName: string | null;
  providerContact: string | null;
  modifiedAt: string | null;
};

type CompletionRow = {
  id: string;
  appliance_id: string;
  maintenance_task_id: string;
  service_date: string | Date;
  provider_name: string | null;
  provider_contact: string | null;
  modified_at: string | Date | null;
};

function toDateOnly(value: string | Date): string {
  if (typeof value === "string") return value;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoOrNull(value: string | Date | null): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function toCompletion(row: CompletionRow): ObligationCompletion {
  return {
    id: row.id,
    applianceId: row.appliance_id,
    maintenanceTaskId: row.maintenance_task_id,
    serviceDate: toDateOnly(row.service_date),
    providerName: row.provider_name,
    providerContact: row.provider_contact,
    modifiedAt: toIsoOrNull(row.modified_at),
  };
}

// Full "C'est fait" history for one appliance, every legal task, most recent
// service_date first (spec's "Managing Appliances", "History, never overwritten": the
// fiche lists it most-recent-first, older entries collapsed).
export async function getObligationCompletionsForAppliance(applianceId: string): Promise<ObligationCompletion[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT id, appliance_id, maintenance_task_id, service_date, provider_name, provider_contact, modified_at
    FROM obligation_completions
    WHERE appliance_id = ${applianceId}
    ORDER BY maintenance_task_id, service_date DESC, created_at DESC
  `) as CompletionRow[];
  return rows.map(toCompletion);
}

// appliance_obligations (the "current status" table obligations.ts computes from) is
// kept in sync with this table's latest row after every write — see
// src/app/actions.ts's syncObligationFromHistory.
export async function getLatestObligationCompletion(
  applianceId: string,
  maintenanceTaskId: string
): Promise<ObligationCompletion | null> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT id, appliance_id, maintenance_task_id, service_date, provider_name, provider_contact, modified_at
    FROM obligation_completions
    WHERE appliance_id = ${applianceId} AND maintenance_task_id = ${maintenanceTaskId}
    ORDER BY service_date DESC, created_at DESC
    LIMIT 1
  `) as CompletionRow[];
  return rows[0] ? toCompletion(rows[0]) : null;
}

// "C'est fait" (spec's "Managing Appliances"): appends a history entry for this month
// rather than overwriting a prior month's. Resubmitting the same month (e.g. a provider
// correction without going through "Modifier") updates that month's own row instead of
// duplicating it; modified_at resets to null, same as the pre-history "C'est fait"
// always did for a fresh (non-edit) answer.
export async function recordObligationCompletion(input: {
  applianceId: string;
  maintenanceTaskId: string;
  serviceDate: string;
  providerName: string | null;
  providerContact: string | null;
}): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`
    INSERT INTO obligation_completions (appliance_id, maintenance_task_id, service_date, provider_name, provider_contact)
    VALUES (${input.applianceId}, ${input.maintenanceTaskId}, ${input.serviceDate}, ${input.providerName}, ${input.providerContact})
    ON CONFLICT (appliance_id, maintenance_task_id, service_date) DO UPDATE SET
      provider_name = EXCLUDED.provider_name,
      provider_contact = EXCLUDED.provider_contact,
      modified_at = NULL
  `;
}

// "Modifier" on a past intervention (spec's "Managing Appliances"): corrects one history
// entry, stamping modified_at so the fiche can show "modifiée le …". Refuses a month
// that already has its own entry for the same task — merging them silently would lose
// one month's record (same rule as editMaintenanceCompletion).
export async function editObligationCompletion(input: {
  id: string;
  applianceId: string;
  maintenanceTaskId: string;
  serviceDate: string;
  providerName: string | null;
  providerContact: string | null;
}): Promise<{ error?: string }> {
  const { sql } = await getAuthedContext();
  const conflict = await sql`
    SELECT 1 FROM obligation_completions
    WHERE appliance_id = ${input.applianceId} AND maintenance_task_id = ${input.maintenanceTaskId}
      AND service_date = ${input.serviceDate} AND id != ${input.id}
    LIMIT 1
  `;
  if (conflict.length > 0) {
    return { error: "Une intervention existe déjà pour ce mois." };
  }
  await sql`
    UPDATE obligation_completions
    SET service_date = ${input.serviceDate}, provider_name = ${input.providerName},
        provider_contact = ${input.providerContact}, modified_at = now()
    WHERE id = ${input.id} AND appliance_id = ${input.applianceId}
  `;
  return {};
}
