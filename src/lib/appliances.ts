import type { Appliance, Category } from "@/lib/appliance-types";
import { getAuthedContext } from "@/lib/db";

type ApplianceRow = {
  id: string;
  name: string | null;
  brand: string | null;
  model: string | null;
  category: string;
  purchase_date: string | Date | null;
  created_at: string | Date;
  place_id: string;
  room: string | null;
  equipment_type_id: string | null;
};

function toDateOnlyString(value: string | Date): string {
  if (typeof value === "string") {
    return value;
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toAppliance(row: ApplianceRow): Appliance {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    model: row.model,
    category: row.category as Category,
    purchaseDate: row.purchase_date === null ? null : toDateOnlyString(row.purchase_date),
    createdAt:
      typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
    placeId: row.place_id,
    room: row.room,
    equipmentTypeId: row.equipment_type_id,
  };
}

export async function getAppliances(): Promise<Appliance[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT id, name, brand, model, category, purchase_date, created_at, place_id, room, equipment_type_id
    FROM appliances
    ORDER BY created_at DESC
  `) as ApplianceRow[];
  return rows.map(toAppliance);
}

export async function addAppliance(input: {
  placeId: string;
  category: Category;
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  purchaseDate?: string | null;
  room?: string | null;
  equipmentTypeId?: string | null;
}): Promise<Appliance> {
  const { sql } = await getAuthedContext();
  const fieldSources: Record<string, string> = {};
  if (input.brand) fieldSources.brand = "manual";
  if (input.model) fieldSources.model = "manual";
  if (input.purchaseDate) fieldSources.purchase_date = "manual";
  fieldSources.category = "manual";

  const rows = (await sql`
    INSERT INTO appliances (
      place_id, category, name, brand, model, purchase_date, room, equipment_type_id, field_sources
    )
    VALUES (
      ${input.placeId}, ${input.category}, ${input.name ?? null}, ${input.brand ?? null},
      ${input.model ?? null}, ${input.purchaseDate ?? null}, ${input.room ?? null},
      ${input.equipmentTypeId ?? null}, ${JSON.stringify(fieldSources)}
    )
    RETURNING id, name, brand, model, category, purchase_date, created_at, place_id, room, equipment_type_id
  `) as ApplianceRow[];
  return toAppliance(rows[0]);
}

export async function deleteAppliance(id: string): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`DELETE FROM appliances WHERE id = ${id}`;
}

// The onboarding questionnaire never duplicates an appliance already in the place: if
// one of this exact equipment type exists there, it's reused (and its obligations, if
// any, are left untouched) rather than creating a second record.
export async function findOrCreateApplianceByType(input: {
  placeId: string;
  equipmentTypeId: string;
  category: Category;
}): Promise<{ appliance: Appliance; created: boolean }> {
  const { sql } = await getAuthedContext();
  const existing = (await sql`
    SELECT id, name, brand, model, category, purchase_date, created_at, place_id, room, equipment_type_id
    FROM appliances
    WHERE place_id = ${input.placeId} AND equipment_type_id = ${input.equipmentTypeId}
    LIMIT 1
  `) as ApplianceRow[];
  if (existing[0]) {
    return { appliance: toAppliance(existing[0]), created: false };
  }
  const appliance = await addAppliance({
    placeId: input.placeId,
    category: input.category,
    equipmentTypeId: input.equipmentTypeId,
  });
  return { appliance, created: true };
}
