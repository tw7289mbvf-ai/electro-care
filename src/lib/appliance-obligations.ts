import type { ApplianceObligationRecord } from "@/lib/obligations";
import { getAuthedContext } from "@/lib/db";

type ObligationRow = {
  appliance_id: string;
  maintenance_task_id: string;
  last_service_date: string | Date | null;
  known_due_date: string | Date | null;
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
  };
}

export async function getObligationRecordsForPlace(placeId: string): Promise<ApplianceObligationRecord[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT ao.appliance_id, ao.maintenance_task_id, ao.last_service_date, ao.known_due_date
    FROM appliance_obligations ao
    JOIN appliances a ON a.id = ao.appliance_id
    WHERE a.place_id = ${placeId}
  `) as ObligationRow[];
  return rows.map(toRecord);
}

export async function getObligationRecordsForAppliance(applianceId: string): Promise<ApplianceObligationRecord[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT appliance_id, maintenance_task_id, last_service_date, known_due_date
    FROM appliance_obligations
    WHERE appliance_id = ${applianceId}
  `) as ObligationRow[];
  return rows.map(toRecord);
}

export async function setApplianceObligation(input: {
  applianceId: string;
  maintenanceTaskId: string;
  lastServiceDate?: string | null;
  knownDueDate?: string | null;
}): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`
    INSERT INTO appliance_obligations (appliance_id, maintenance_task_id, last_service_date, known_due_date)
    VALUES (${input.applianceId}, ${input.maintenanceTaskId}, ${input.lastServiceDate ?? null}, ${input.knownDueDate ?? null})
    ON CONFLICT (appliance_id, maintenance_task_id) DO UPDATE SET
      last_service_date = EXCLUDED.last_service_date,
      known_due_date = EXCLUDED.known_due_date
  `;
}
