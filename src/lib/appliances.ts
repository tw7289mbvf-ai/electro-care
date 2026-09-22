import { neon } from "@neondatabase/serverless";
import type { Appliance, Category } from "@/lib/appliance-types";

const sql = neon(process.env.DATABASE_URL!);

type ApplianceRow = {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  purchase_date: string | Date;
  created_at: string | Date;
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
    purchaseDate: toDateOnlyString(row.purchase_date),
    createdAt:
      typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
  };
}

export async function getAppliances(): Promise<Appliance[]> {
  const rows = (await sql`
    SELECT id, name, brand, model, category, purchase_date, created_at
    FROM appliances
    ORDER BY created_at DESC
  `) as ApplianceRow[];
  return rows.map(toAppliance);
}

async function getDefaultPlaceId(): Promise<string> {
  const rows = (await sql`
    SELECT id FROM places ORDER BY created_at ASC LIMIT 1
  `) as { id: string }[];
  if (!rows[0]) {
    throw new Error("No place found: run the places migration before adding appliances.");
  }
  return rows[0].id;
}

export async function addAppliance(input: {
  name: string;
  brand: string;
  model: string;
  category: Category;
  purchaseDate: string;
}): Promise<Appliance> {
  const placeId = await getDefaultPlaceId();
  const fieldSources = { brand: "manual", model: "manual", category: "manual", purchase_date: "manual" };
  const rows = (await sql`
    INSERT INTO appliances (name, brand, model, category, purchase_date, place_id, field_sources)
    VALUES (
      ${input.name}, ${input.brand}, ${input.model}, ${input.category}, ${input.purchaseDate},
      ${placeId}, ${JSON.stringify(fieldSources)}
    )
    RETURNING id, name, brand, model, category, purchase_date, created_at
  `) as ApplianceRow[];
  return toAppliance(rows[0]);
}

export async function deleteAppliance(id: string): Promise<void> {
  await sql`DELETE FROM appliances WHERE id = ${id}`;
}
