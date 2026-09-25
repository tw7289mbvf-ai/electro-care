import { getAuthedContext } from "@/lib/db";

export type MaintenanceCompletion = {
  applianceId: string;
  maintenanceTaskId: string;
  doneMonth: string;
};

type CompletionRow = {
  appliance_id: string;
  maintenance_task_id: string;
  done_month: string;
};

function toCompletion(row: CompletionRow): MaintenanceCompletion {
  return { applianceId: row.appliance_id, maintenanceTaskId: row.maintenance_task_id, doneMonth: row.done_month };
}

export async function getMaintenanceCompletionsForPlace(placeId: string, month: string): Promise<MaintenanceCompletion[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT mc.appliance_id, mc.maintenance_task_id, mc.done_month
    FROM maintenance_completions mc
    JOIN appliances a ON a.id = mc.appliance_id
    WHERE a.place_id = ${placeId} AND mc.done_month = ${month}
  `) as CompletionRow[];
  return rows.map(toCompletion);
}

export async function isMaintenanceTaskDoneThisMonth(
  applianceId: string,
  maintenanceTaskId: string,
  month: string
): Promise<boolean> {
  const { sql } = await getAuthedContext();
  const rows = await sql`
    SELECT 1 FROM maintenance_completions
    WHERE appliance_id = ${applianceId} AND maintenance_task_id = ${maintenanceTaskId} AND done_month = ${month}
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function recordMaintenanceCompletion(input: {
  applianceId: string;
  maintenanceTaskId: string;
  doneMonth: string;
}): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`
    INSERT INTO maintenance_completions (appliance_id, maintenance_task_id, done_month)
    VALUES (${input.applianceId}, ${input.maintenanceTaskId}, ${input.doneMonth})
    ON CONFLICT (appliance_id, maintenance_task_id, done_month) DO NOTHING
  `;
}
