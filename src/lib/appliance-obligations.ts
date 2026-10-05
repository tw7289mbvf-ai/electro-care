import type { ApplianceObligationRecord } from "@/lib/obligations";
import { getAuthedContext } from "@/lib/db";

type ObligationRow = {
  appliance_id: string;
  maintenance_task_id: string;
  last_service_date: string | Date | null;
  known_due_date: string | Date | null;
  service_confidence: string | null;
  provider_name: string | null;
  provider_contact: string | null;
  modified_at: string | Date | null;
};

export function toDateOnlyOrNull(value: string | Date | null): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoDateTimeOrNull(value: string | Date | null): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function toRecord(row: ObligationRow): ApplianceObligationRecord {
  return {
    applianceId: row.appliance_id,
    maintenanceTaskId: row.maintenance_task_id,
    lastServiceDate: toDateOnlyOrNull(row.last_service_date),
    knownDueDate: toDateOnlyOrNull(row.known_due_date),
    serviceConfidence: row.service_confidence as ApplianceObligationRecord["serviceConfidence"],
    providerName: row.provider_name,
    providerContact: row.provider_contact,
    modifiedAt: toIsoDateTimeOrNull(row.modified_at),
  };
}

export async function getObligationRecordsForPlace(placeId: string): Promise<ApplianceObligationRecord[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT ao.appliance_id, ao.maintenance_task_id, ao.last_service_date, ao.known_due_date,
           ao.service_confidence, ao.provider_name, ao.provider_contact, ao.modified_at
    FROM appliance_obligations ao
    JOIN appliances a ON a.id = ao.appliance_id
    WHERE a.place_id = ${placeId}
  `) as ObligationRow[];
  return rows.map(toRecord);
}

export async function getObligationRecordsForAppliance(applianceId: string): Promise<ApplianceObligationRecord[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT appliance_id, maintenance_task_id, last_service_date, known_due_date,
           service_confidence, provider_name, provider_contact, modified_at
    FROM appliance_obligations
    WHERE appliance_id = ${applianceId}
  `) as ObligationRow[];
  return rows.map(toRecord);
}

// Every call writes every column below (defaulting the ones it doesn't pass to null), so
// an obligation record always holds exactly one kind of answer at a time: an exact date,
// a known future due date, a REGLE-01 confidence grade, or nothing ("à planifier"). E.g.
// giving a precise last-service date always clears a prior "recent"/"old"/"never" grade.
// provider_name/provider_contact follow the same "this call's own answer" rule: they
// describe this intervention, not an accumulated contact book, so a later call without
// them (e.g. a questionnaire date answer) clears them rather than leaving a stale name.
export async function setApplianceObligation(input: {
  applianceId: string;
  maintenanceTaskId: string;
  lastServiceDate?: string | null;
  knownDueDate?: string | null;
  serviceConfidence?: "recent" | "old" | "never" | "compliant" | null;
  providerName?: string | null;
  providerContact?: string | null;
  // "Modifier" (spec's "Managing Appliances"): true only for the edit flow, so
  // modified_at ("modifiée le …") stays unset for a fresh "C'est fait"/"Mettre à jour"
  // answer, including one that overwrites a previously modified record for a new cycle.
  modified?: boolean;
}): Promise<void> {
  const { sql } = await getAuthedContext();
  const modifiedAt = input.modified ? new Date().toISOString() : null;
  await sql`
    INSERT INTO appliance_obligations (
      appliance_id, maintenance_task_id, last_service_date, known_due_date, service_confidence,
      provider_name, provider_contact, modified_at
    )
    VALUES (
      ${input.applianceId}, ${input.maintenanceTaskId}, ${input.lastServiceDate ?? null}, ${input.knownDueDate ?? null},
      ${input.serviceConfidence ?? null}, ${input.providerName ?? null}, ${input.providerContact ?? null}, ${modifiedAt}
    )
    ON CONFLICT (appliance_id, maintenance_task_id) DO UPDATE SET
      last_service_date = EXCLUDED.last_service_date,
      known_due_date = EXCLUDED.known_due_date,
      service_confidence = EXCLUDED.service_confidence,
      provider_name = EXCLUDED.provider_name,
      provider_contact = EXCLUDED.provider_contact,
      modified_at = EXCLUDED.modified_at
  `;
}
