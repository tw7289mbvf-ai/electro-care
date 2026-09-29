import type { Appliance, Category } from "@/lib/appliance-types";
import { getAuthedContext } from "@/lib/db";

type ApplianceRow = {
  id: string;
  name: string | null;
  brand: string | null;
  model: string | null;
  category: string;
  purchase_date: string | Date | null;
  warranty_end: string | Date | null;
  created_at: string | Date;
  place_id: string;
  room: string | null;
  equipment_type_id: string | null;
  power_kw: string | number | null;
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
    warrantyEnd: row.warranty_end === null ? null : toDateOnlyString(row.warranty_end),
    createdAt:
      typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString(),
    placeId: row.place_id,
    room: row.room,
    equipmentTypeId: row.equipment_type_id,
    powerKw: row.power_kw === null ? null : Number(row.power_kw),
  };
}

const APPLIANCE_COLUMNS = `id, name, brand, model, category, purchase_date, warranty_end, created_at, place_id, room, equipment_type_id, power_kw`;

export async function getAppliances(): Promise<Appliance[]> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT ${sql.unsafe(APPLIANCE_COLUMNS)}
    FROM appliances
    ORDER BY created_at DESC
  `) as ApplianceRow[];
  return rows.map(toAppliance);
}

export async function getAppliance(id: string): Promise<Appliance | null> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT ${sql.unsafe(APPLIANCE_COLUMNS)}
    FROM appliances
    WHERE id = ${id}
  `) as ApplianceRow[];
  return rows[0] ? toAppliance(rows[0]) : null;
}

export async function countAppliancesForPlace(placeId: string): Promise<number> {
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    SELECT count(*)::int AS count FROM appliances WHERE place_id = ${placeId}
  `) as { count: number }[];
  return rows[0]?.count ?? 0;
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
    RETURNING ${sql.unsafe(APPLIANCE_COLUMNS)}
  `) as ApplianceRow[];
  return toAppliance(rows[0]);
}

export async function deleteAppliance(id: string): Promise<void> {
  const { sql } = await getAuthedContext();
  await sql`DELETE FROM appliances WHERE id = ${id}`;
}

// Fiche appareil edit: brand, model, power and purchase date are nameplate/invoice
// identity fields (see CLAUDE.md), each tracked in field_sources. A field left blank
// here loses its field_sources key rather than being recorded as a "manual" empty
// value — CLAUDE.md: "When a field is cleared, delete its field_sources key, never set
// it to null."
export async function updateAppliance(
  id: string,
  input: {
    brand: string | null;
    model: string | null;
    powerKw: number | null;
    purchaseDate: string | null;
    warrantyEnd: string | null;
    room: string | null;
  }
): Promise<Appliance> {
  const { sql } = await getAuthedContext();
  const [existing] = (await sql`
    SELECT field_sources FROM appliances WHERE id = ${id}
  `) as { field_sources: Record<string, string> }[];
  const fieldSources: Record<string, string> = { ...(existing?.field_sources ?? {}) };
  const tracked: Array<[string, string | number | null]> = [
    ["brand", input.brand],
    ["model", input.model],
    ["power_kw", input.powerKw],
    ["purchase_date", input.purchaseDate],
    ["warranty_end", input.warrantyEnd],
  ];
  for (const [key, value] of tracked) {
    if (value === null) delete fieldSources[key];
    else fieldSources[key] = "manual";
  }

  const rows = (await sql`
    UPDATE appliances
    SET brand = ${input.brand}, model = ${input.model}, power_kw = ${input.powerKw},
        purchase_date = ${input.purchaseDate}, warranty_end = ${input.warrantyEnd}, room = ${input.room},
        field_sources = ${JSON.stringify(fieldSources)}
    WHERE id = ${id}
    RETURNING ${sql.unsafe(APPLIANCE_COLUMNS)}
  `) as ApplianceRow[];
  return toAppliance(rows[0]);
}

// The orange "Mettre à jour" power-threshold window (spec's "Actions and colours") only
// ever resolves the power, so it writes just that column — never the full replace
// `updateAppliance` does, which would blank out brand/model/etc. left unset by this
// narrower form. Has the same effect as entering the power in the appliance card
// (spec: "entering the power in the appliance card has the same effect").
export async function setAppliancePowerKw(id: string, powerKw: number): Promise<Appliance> {
  const { sql } = await getAuthedContext();
  const [existing] = (await sql`
    SELECT field_sources FROM appliances WHERE id = ${id}
  `) as { field_sources: Record<string, string> }[];
  const fieldSources: Record<string, string> = { ...(existing?.field_sources ?? {}), power_kw: "manual" };
  const rows = (await sql`
    UPDATE appliances
    SET power_kw = ${powerKw}, field_sources = ${JSON.stringify(fieldSources)}
    WHERE id = ${id}
    RETURNING ${sql.unsafe(APPLIANCE_COLUMNS)}
  `) as ApplianceRow[];
  return toAppliance(rows[0]);
}

// The onboarding questionnaire never duplicates an appliance already in the place: if
// one of this exact equipment type exists there, it's reused (and its obligations, if
// any, are left untouched) rather than creating a second record. A plain
// check-then-insert races when the same step is submitted twice at once (double
// click, two open tabs on the same place): both requests can see "not found" before
// either commits, and both insert. An advisory lock scoped to this exact
// (place, equipment type) pair — held only for this one transaction — serializes that
// specific race without a table-wide unique constraint, which would also block two
// legitimately identical splits installed in two different rooms (the manual-entry
// path in this file never takes this lock and is unaffected).
export async function findOrCreateApplianceByType(input: {
  placeId: string;
  equipmentTypeId: string;
  category: Category;
}): Promise<{ appliance: Appliance; created: boolean }> {
  const { sql } = await getAuthedContext();
  const [, inserted, existing] = (await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtext(${input.placeId}), hashtext(${input.equipmentTypeId}))`,
    sql`
      INSERT INTO appliances (place_id, category, equipment_type_id, field_sources)
      SELECT ${input.placeId}, ${input.category}, ${input.equipmentTypeId}, '{"category":"manual"}'::jsonb
      WHERE NOT EXISTS (
        SELECT 1 FROM appliances WHERE place_id = ${input.placeId} AND equipment_type_id = ${input.equipmentTypeId}
      )
      RETURNING ${sql.unsafe(APPLIANCE_COLUMNS)}
    `,
    sql`
      SELECT ${sql.unsafe(APPLIANCE_COLUMNS)}
      FROM appliances
      WHERE place_id = ${input.placeId} AND equipment_type_id = ${input.equipmentTypeId}
      LIMIT 1
    `,
  ])) as [unknown, ApplianceRow[], ApplianceRow[]];

  if (inserted[0]) {
    return { appliance: toAppliance(inserted[0]), created: true };
  }
  return { appliance: toAppliance(existing[0]), created: false };
}

// Invoice import ("Complete, don't duplicate", CLAUDE.md): reuses
// findOrCreateApplianceByType's race-safe find-or-create for the (place, equipment
// type) pair, then fills only the columns still empty. COALESCE keeps whatever the
// appliance already had (e.g. a brand typed by hand) rather than overwriting it, and
// the field_sources CASEs read the pre-update row (Postgres evaluates every SET
// expression against the row as it was before this statement), so a field is stamped
// "invoice" only when this call is the one that actually filled it.
export async function importApplianceFromInvoice(input: {
  placeId: string;
  equipmentTypeId: string;
  category: Category;
  brand: string | null;
  model: string | null;
  purchaseDate: string | null;
  warrantyEnd: string | null;
}): Promise<{ appliance: Appliance; created: boolean }> {
  const { appliance: base, created } = await findOrCreateApplianceByType({
    placeId: input.placeId,
    equipmentTypeId: input.equipmentTypeId,
    category: input.category,
  });
  const { sql } = await getAuthedContext();
  const rows = (await sql`
    UPDATE appliances SET
      brand = COALESCE(brand, ${input.brand}),
      model = COALESCE(model, ${input.model}),
      purchase_date = COALESCE(purchase_date, ${input.purchaseDate}),
      warranty_end = COALESCE(warranty_end, ${input.warrantyEnd}),
      field_sources = field_sources || jsonb_strip_nulls(jsonb_build_object(
        'brand', CASE WHEN brand IS NULL AND ${input.brand}::text IS NOT NULL THEN 'invoice' END,
        'model', CASE WHEN model IS NULL AND ${input.model}::text IS NOT NULL THEN 'invoice' END,
        'purchase_date', CASE WHEN purchase_date IS NULL AND ${input.purchaseDate}::date IS NOT NULL THEN 'invoice' END,
        'warranty_end', CASE WHEN warranty_end IS NULL AND ${input.warrantyEnd}::date IS NOT NULL THEN 'invoice' END
      ))
    WHERE id = ${base.id}
    RETURNING ${sql.unsafe(APPLIANCE_COLUMNS)}
  `) as ApplianceRow[];
  return { appliance: toAppliance(rows[0]), created };
}
