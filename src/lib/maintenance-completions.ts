import { getAuthedContext } from "@/lib/db";

export type MaintenanceCompletion = {
  id: string;
  applianceId: string;
  maintenanceTaskId: string;
  doneMonth: string;
  modifiedAt: string | null;
};

type CompletionRow = {
  id: string;
  appliance_id: string;
  maintenance_task_id: string;
  done_month: string;
  modified_at: string | Date | null;
};

function toIso(value: string | Date | null): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function toCompletion(row: CompletionRow): MaintenanceCompletion {
  return {
    id: row.id,
    applianceId: row.appliance_id,
    maintenanceTaskId: row.maintenance_task_id,
    doneMonth: row.done_month,
    modifiedAt: toIso(row.modified_at),
  };
}

export async function getMaintenanceCompletionsForPlace(placeId: string, month: string): Promise<MaintenanceCompletion[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT mc.id, mc.appliance_id, mc.maintenance_task_id, mc.done_month, mc.modified_at
    FROM maintenance_completions mc
    JOIN appliances a ON a.id = mc.appliance_id
    WHERE a.place_id = ${placeId} AND mc.done_month = ${month}
  `) as CompletionRow[];
  return rows.map(toCompletion);
}

// "Réalisé" (spec's "Managing Appliances"): the most recent completion per task, any
// month — unlike getMaintenanceCompletionsForPlace, which only looks at one calendar
// month for the "À faire" filter.
export async function getLatestMaintenanceCompletionsForAppliance(applianceId: string): Promise<MaintenanceCompletion[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT DISTINCT ON (maintenance_task_id) id, appliance_id, maintenance_task_id, done_month, modified_at
    FROM maintenance_completions
    WHERE appliance_id = ${applianceId}
    ORDER BY maintenance_task_id, done_month DESC
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

// "Modifier" on a past realisation (spec's "Managing Appliances"): corrects the month of
// an existing completion, stamping modified_at so the fiche can show "modifiée le …".
// Refuses a month that already has its own completion row for the same task — merging
// them silently would lose one month's record.
export async function editMaintenanceCompletion(input: {
  id: string;
  applianceId: string;
  maintenanceTaskId: string;
  doneMonth: string;
}): Promise<{ error?: string }> {
  const { sql } = await getAuthedContext();
  const conflict = await sql`
    SELECT 1 FROM maintenance_completions
    WHERE appliance_id = ${input.applianceId} AND maintenance_task_id = ${input.maintenanceTaskId}
      AND done_month = ${input.doneMonth} AND id != ${input.id}
    LIMIT 1
  `;
  if (conflict.length > 0) {
    return { error: "Une réalisation existe déjà pour ce mois." };
  }
  await sql`
    UPDATE maintenance_completions SET done_month = ${input.doneMonth}, modified_at = now()
    WHERE id = ${input.id} AND appliance_id = ${input.applianceId}
  `;
  return {};
}
