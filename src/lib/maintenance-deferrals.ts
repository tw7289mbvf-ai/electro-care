import { getAuthedContext } from "@/lib/db";

export type MaintenanceDeferral = {
  applianceId: string;
  maintenanceTaskId: string;
  originMonth: string;
  deferredToMonth: string;
};

type DeferralRow = {
  appliance_id: string;
  maintenance_task_id: string;
  origin_month: string;
  deferred_to_month: string;
};

function toDeferral(row: DeferralRow): MaintenanceDeferral {
  return {
    applianceId: row.appliance_id,
    maintenanceTaskId: row.maintenance_task_id,
    originMonth: row.origin_month,
    deferredToMonth: row.deferred_to_month,
  };
}

export async function getMaintenanceDeferralsForPlace(placeId: string): Promise<MaintenanceDeferral[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT md.appliance_id, md.maintenance_task_id, md.origin_month, md.deferred_to_month
    FROM maintenance_deferrals md
    JOIN appliances a ON a.id = md.appliance_id
    WHERE a.place_id = ${placeId}
  `) as DeferralRow[];
  return rows.map(toDeferral);
}

export async function getMaintenanceDeferral(
  applianceId: string,
  maintenanceTaskId: string
): Promise<MaintenanceDeferral | null> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT appliance_id, maintenance_task_id, origin_month, deferred_to_month
    FROM maintenance_deferrals
    WHERE appliance_id = ${applianceId} AND maintenance_task_id = ${maintenanceTaskId}
  `) as DeferralRow[];
  return rows[0] ? toDeferral(rows[0]) : null;
}

// origin_month is only ever written on the first defer of a cycle: ON CONFLICT here
// touches deferred_to_month alone, so repeated "Reporter" clicks keep measuring the
// shift from where the task was actually due (canDeferMaintenanceTask's cap).
export async function deferMaintenanceTask(input: {
  applianceId: string;
  maintenanceTaskId: string;
  originMonth: string;
  deferredToMonth: string;
}): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`
    INSERT INTO maintenance_deferrals (appliance_id, maintenance_task_id, origin_month, deferred_to_month)
    VALUES (${input.applianceId}, ${input.maintenanceTaskId}, ${input.originMonth}, ${input.deferredToMonth})
    ON CONFLICT (appliance_id, maintenance_task_id) DO UPDATE SET
      deferred_to_month = EXCLUDED.deferred_to_month
  `;
}

// Resets the cycle: called when the task is marked done, so a later new occurrence
// doesn't inherit a stale origin_month from a previous one.
export async function clearMaintenanceDeferral(applianceId: string, maintenanceTaskId: string): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`
    DELETE FROM maintenance_deferrals WHERE appliance_id = ${applianceId} AND maintenance_task_id = ${maintenanceTaskId}
  `;
}
