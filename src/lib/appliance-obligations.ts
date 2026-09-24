import type { ApplianceObligationRecord } from "@/lib/obligations";
import { getAuthedContext } from "@/lib/db";

type ObligationRow = {
  appliance_id: string;
  maintenance_task_id: string;
  last_service_date: string | Date | null;
  known_due_date: string | Date | null;
  service_confidence: string | null;
};

function toDateOnlyOrNull(value: string | Date | null): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toRecord(row: ObligationRow): ApplianceObligationRecord {
  return {
    applianceId: row.appliance_id,
    maintenanceTaskId: row.maintenance_task_id,
    lastServiceDate: toDateOnlyOrNull(row.last_service_date),
    knownDueDate: toDateOnlyOrNull(row.known_due_date),
    serviceConfidence: row.service_confidence as ApplianceObligationRecord["serviceConfidence"],
  };
}

export async function getObligationRecordsForPlace(placeId: string): Promise<ApplianceObligationRecord[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT ao.appliance_id, ao.maintenance_task_id, ao.last_service_date, ao.known_due_date, ao.service_confidence
    FROM appliance_obligations ao
    JOIN appliances a ON a.id = ao.appliance_id
    WHERE a.place_id = ${placeId}
  `) as ObligationRow[];
  return rows.map(toRecord);
}

export async function getObligationRecordsForAppliance(applianceId: string): Promise<ApplianceObligationRecord[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT appliance_id, maintenance_task_id, last_service_date, known_due_date, service_confidence
    FROM appliance_obligations
    WHERE appliance_id = ${applianceId}
  `) as ObligationRow[];
  return rows.map(toRecord);
}

// Every call writes all three columns (defaulting the ones it doesn't pass to null), so
// an obligation record always holds exactly one kind of answer at a time: an exact date,
// a known future due date, a REGLE-01 confidence grade, or nothing ("à planifier"). E.g.
// giving a precise last-service date always clears a prior "recent"/"old"/"never" grade.
export async function setApplianceObligation(input: {
  applianceId: string;
  maintenanceTaskId: string;
  lastServiceDate?: string | null;
  knownDueDate?: string | null;
  serviceConfidence?: "recent" | "old" | "never" | null;
}): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`
    INSERT INTO appliance_obligations (appliance_id, maintenance_task_id, last_service_date, known_due_date, service_confidence)
    VALUES (${input.applianceId}, ${input.maintenanceTaskId}, ${input.lastServiceDate ?? null}, ${input.knownDueDate ?? null}, ${input.serviceConfidence ?? null})
    ON CONFLICT (appliance_id, maintenance_task_id) DO UPDATE SET
      last_service_date = EXCLUDED.last_service_date,
      known_due_date = EXCLUDED.known_due_date,
      service_confidence = EXCLUDED.service_confidence
  `;
}
