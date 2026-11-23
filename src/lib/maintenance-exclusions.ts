import { getAuthedContext } from "@/lib/db";

// « Mon appareil n'a pas cet élément » (spec "Maintenance Guidance"): a generic task can
// name a part some models lack (a washing machine without an accessible drain filter),
// so the user rules it out for that appliance. The task becomes « Non concerné »: out of
// the month's maintenance, « À faire », « À venir » and the time estimate, listed in a
// collapsed group on the appliance card with « Rétablir ». Never on a legal obligation.
export type MaintenanceExclusion = {
  applianceId: string;
  maintenanceTaskId: string;
  createdAt: string;
};

type ExclusionRow = { appliance_id: string; maintenance_task_id: string; created_at: string | Date };

function toExclusion(row: ExclusionRow): MaintenanceExclusion {
  return {
    applianceId: row.appliance_id,
    maintenanceTaskId: row.maintenance_task_id,
    createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
  };
}

export function exclusionKey(applianceId: string, maintenanceTaskId: string): string {
  return `${applianceId}:${maintenanceTaskId}`;
}

export function exclusionKeys(exclusions: MaintenanceExclusion[]): Set<string> {
  return new Set(exclusions.map((e) => exclusionKey(e.applianceId, e.maintenanceTaskId)));
}

export async function getMaintenanceExclusionsForPlace(placeId: string): Promise<MaintenanceExclusion[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT me.appliance_id, me.maintenance_task_id, me.created_at
    FROM maintenance_task_exclusions me
    JOIN appliances a ON a.id = me.appliance_id
    WHERE a.place_id = ${placeId}
  `) as ExclusionRow[];
  return rows.map(toExclusion);
}

export async function getMaintenanceExclusionsForAppliance(applianceId: string): Promise<MaintenanceExclusion[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT appliance_id, maintenance_task_id, created_at
    FROM maintenance_task_exclusions
    WHERE appliance_id = ${applianceId}
    ORDER BY created_at
  `) as ExclusionRow[];
  return rows.map(toExclusion);
}

export async function excludeMaintenanceTask(applianceId: string, maintenanceTaskId: string): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`
    INSERT INTO maintenance_task_exclusions (appliance_id, maintenance_task_id)
    VALUES (${applianceId}, ${maintenanceTaskId})
    ON CONFLICT (appliance_id, maintenance_task_id) DO NOTHING
  `;
}

export async function restoreMaintenanceTask(applianceId: string, maintenanceTaskId: string): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`DELETE FROM maintenance_task_exclusions WHERE appliance_id = ${applianceId} AND maintenance_task_id = ${maintenanceTaskId}`;
}
