import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
}

const seedPath = (name) => fileURLToPath(new URL(`../seed/${name}`, import.meta.url));
const categories = JSON.parse(readFileSync(seedPath("categories.json"), "utf8"));
const enums = JSON.parse(readFileSync(seedPath("enums.json"), "utf8"));
const equipmentTypes = JSON.parse(readFileSync(seedPath("equipment_types.json"), "utf8"));
const equipmentTypesById = new Map(equipmentTypes.map((t) => [t.id, t]));

// Fixed id so the singleton default place is idempotent to (re)insert and to reference.
const DEFAULT_PLACE_ID = "00000000-0000-0000-0000-000000000001";

// 2026-09 categories update (16 -> 10 keys): old categories that fold into more than
// one new category depending on the specific equipment (e.g. "washing" covers both
// dishwashers, now "kitchen", and washing machines, now "laundry") are never resolved
// by a plain lookup — only equipment_type_id can disambiguate them. "small_appliances"
// is listed here too: it is also a valid *new* key, but the old "small_appliances"
// technical group itself splits into new "small_appliances" and "laundry".
const AMBIGUOUS_OLD_CATEGORIES = new Set(["hot_water", "ventilation", "washing", "small_appliances"]);

// Old categories that translate to exactly one new category regardless of equipment type.
const DIRECT_CATEGORY_MAP = {
  heating: "heating_cooling",
  cooling: "heating_cooling",
  refrigeration: "kitchen",
  cooking: "kitchen",
  water: "home_safety",
  wastewater: "home_safety",
  safety: "home_safety",
  doors_gates: "home_safety",
  building: "home_safety",
  pool: "garden_pool",
  garden: "garden_pool",
  energy: "energy",
};

function resolveCategory(row, categoryKeys, equipmentTypesById) {
  if (row.equipment_type_id) {
    const type = equipmentTypesById.get(row.equipment_type_id);
    if (type) return type.category;
  }
  if (!AMBIGUOUS_OLD_CATEGORIES.has(row.category) && categoryKeys.has(row.category)) return row.category;
  if (DIRECT_CATEGORY_MAP[row.category]) return DIRECT_CATEGORY_MAP[row.category];
  return null;
}

function sqlKeyList(entries) {
  return entries.map((e) => `'${e.key.toString().replace(/'/g, "''")}'`).join(", ");
}

const client = new Client(databaseUrl);
await client.connect();

try {
  await client.query("BEGIN");

  await client.query(`
    CREATE TABLE IF NOT EXISTS appliances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      category TEXT NOT NULL,
      purchase_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Gate before any real change: every existing category must resolve via its
  // equipment_type_id, the direct map, or already being a valid seed key. Otherwise
  // abort and roll back.
  const categoryKeys = new Set(categories.map((c) => c.key));
  const { rows: existing } = await client.query(
    "SELECT id, name, brand, model, category, equipment_type_id FROM appliances"
  );
  const unresolved = existing.filter(
    (row) => resolveCategory(row, categoryKeys, equipmentTypesById) === null
  );
  if (unresolved.length > 0) {
    const list = unresolved
      .map(
        (r) =>
          `  - ${r.name ?? "(sans nom)"} (${r.brand ?? "?"} ${r.model ?? "?"}, id=${r.id}) : catégorie ` +
          `"${r.category}"${r.equipment_type_id ? ` / type "${r.equipment_type_id}" inconnu` : " sans type d'appareil"}, non reconnue`
      )
      .join("\n");
    throw new Error(
      `Migration arrêtée avant toute modification : ${unresolved.length} fiche(s) ont une catégorie ` +
        `qui ne correspond à aucune clé de seed/categories.json et ne peuvent pas être reclassées ` +
        `automatiquement (catégorie ambiguë sans equipment_type_id, ou type d'appareil introuvable ` +
        `dans seed/equipment_types.json) :\n${list}\n` +
        `Renseignez l'equipment_type_id de ces fiches, ou ajoutez une entrée dans DIRECT_CATEGORY_MAP ` +
        `dans scripts/migrate.mjs, puis relancez.`
    );
  }

  // --- Places ---------------------------------------------------------------

  await client.query(`
    CREATE TABLE IF NOT EXISTS places (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      commune TEXT,
      postcode TEXT,
      property_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`ALTER TABLE places DROP CONSTRAINT IF EXISTS places_property_type_check`);
  await client.query(`
    ALTER TABLE places ADD CONSTRAINT places_property_type_check
      CHECK (property_type IS NULL OR property_type IN (${sqlKeyList(enums.property_type)}))
  `);

  // A place without a commune is valid: legal reminders fall back to national rules
  // (e.g. SPANC 10 years, ramonage annuel) until the commune is filled in.
  await client.query(
    `INSERT INTO places (id, name) VALUES ($1, 'Mon logement') ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_PLACE_ID]
  );

  await client.query(`ALTER TABLE appliances ADD COLUMN IF NOT EXISTS place_id UUID`);
  await client.query(`UPDATE appliances SET place_id = $1 WHERE place_id IS NULL`, [DEFAULT_PLACE_ID]);
  await client.query(`ALTER TABLE appliances ALTER COLUMN place_id SET NOT NULL`);
  await client.query(`ALTER TABLE appliances DROP CONSTRAINT IF EXISTS appliances_place_id_fkey`);
  await client.query(`
    ALTER TABLE appliances ADD CONSTRAINT appliances_place_id_fkey
      FOREIGN KEY (place_id) REFERENCES places(id)
  `);

  // --- Categories -------------------------------------------------------------

  await client.query(`
    CREATE TABLE IF NOT EXISTS categories (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      sort_order INT NOT NULL
    )
  `);
  await client.query(
    `ALTER TABLE categories ADD COLUMN IF NOT EXISTS maintenance_plan BOOLEAN NOT NULL DEFAULT true`
  );

  for (const category of categories) {
    await client.query(
      `INSERT INTO categories (key, label, sort_order, maintenance_plan) VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, maintenance_plan = EXCLUDED.maintenance_plan`,
      [category.key, category.label, category.order, category.maintenance_plan]
    );
  }

  // --- Appliance fields: nameplate data, equipment type, provenance -----------
  // (added before the reclassification updates below, which set equipment_type_id)

  await client.query(`ALTER TABLE appliances ALTER COLUMN name DROP NOT NULL`);
  await client.query(`ALTER TABLE appliances ALTER COLUMN brand DROP NOT NULL`);
  await client.query(`ALTER TABLE appliances ALTER COLUMN model DROP NOT NULL`);
  await client.query(`ALTER TABLE appliances ALTER COLUMN purchase_date DROP NOT NULL`);

  await client.query(`ALTER TABLE appliances ADD COLUMN IF NOT EXISTS serial_number TEXT`);
  await client.query(`ALTER TABLE appliances ADD COLUMN IF NOT EXISTS room TEXT`);
  await client.query(`ALTER TABLE appliances ADD COLUMN IF NOT EXISTS power_kw NUMERIC`);
  await client.query(`ALTER TABLE appliances ADD COLUMN IF NOT EXISTS refrigerant TEXT`);
  await client.query(`ALTER TABLE appliances ADD COLUMN IF NOT EXISTS refrigerant_charge_kg NUMERIC`);
  await client.query(`ALTER TABLE appliances ADD COLUMN IF NOT EXISTS hermetically_sealed BOOLEAN`);
  await client.query(`ALTER TABLE appliances ADD COLUMN IF NOT EXISTS manufacture_date DATE`);
  await client.query(`ALTER TABLE appliances ADD COLUMN IF NOT EXISTS equipment_type_id TEXT`);

  for (const row of existing) {
    const target = resolveCategory(row, categoryKeys, equipmentTypesById);
    if (target !== row.category) {
      await client.query(`UPDATE appliances SET category = $1 WHERE id = $2`, [target, row.id]);
    }
  }

  await client.query(`ALTER TABLE appliances DROP CONSTRAINT IF EXISTS appliances_category_fkey`);
  await client.query(`
    ALTER TABLE appliances ADD CONSTRAINT appliances_category_fkey
      FOREIGN KEY (category) REFERENCES categories(key)
  `);

  // Every appliance now points at a current category key; drop the categories that
  // 2026-09's 16 -> 10 taxonomy update removed (keeping any key still in the new seed,
  // e.g. "small_appliances" and "energy" which exist in both).
  await client.query(`DELETE FROM categories WHERE key NOT IN (${sqlKeyList(categories)})`);

  // --- Field provenance --------------------------------------------------------

  // Each value must be a JSON string from enums.field_source: jsonb_typeof rejects
  // null, numbers, booleans, objects and arrays before the enum-membership check runs.
  await client.query(`
    CREATE OR REPLACE FUNCTION valid_field_sources(sources JSONB) RETURNS BOOLEAN AS $func$
    DECLARE
      entry RECORD;
    BEGIN
      FOR entry IN SELECT value FROM jsonb_each(sources) LOOP
        IF jsonb_typeof(entry.value) <> 'string' THEN
          RETURN FALSE;
        END IF;
        IF (entry.value #>> '{}') NOT IN (${sqlKeyList(enums.field_source)}) THEN
          RETURN FALSE;
        END IF;
      END LOOP;
      RETURN TRUE;
    END;
    $func$ LANGUAGE plpgsql IMMUTABLE
  `);

  await client.query(
    `ALTER TABLE appliances ADD COLUMN IF NOT EXISTS field_sources JSONB NOT NULL DEFAULT '{}'::jsonb`
  );
  await client.query(`ALTER TABLE appliances DROP CONSTRAINT IF EXISTS appliances_field_sources_check`);
  await client.query(`
    ALTER TABLE appliances ADD CONSTRAINT appliances_field_sources_check
      CHECK (valid_field_sources(field_sources))
  `);

  // Every field on these pre-migration records was manually typed: no invoice or
  // nameplate capture existed yet.
  await client.query(`
    UPDATE appliances
    SET field_sources = jsonb_strip_nulls(jsonb_build_object(
      'brand', CASE WHEN brand IS NOT NULL THEN 'manual' END,
      'model', CASE WHEN model IS NOT NULL THEN 'manual' END,
      'purchase_date', CASE WHEN purchase_date IS NOT NULL THEN 'manual' END,
      'category', 'manual'
    ))
    WHERE field_sources = '{}'::jsonb
  `);

  // --- Documents ---------------------------------------------------------------

  await client.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_type TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      original_filename TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_document_type_check`);
  await client.query(`
    ALTER TABLE documents ADD CONSTRAINT documents_document_type_check
      CHECK (document_type IN (${sqlKeyList(enums.document_type)}))
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS document_appliances (
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      appliance_id UUID NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
      PRIMARY KEY (document_id, appliance_id)
    )
  `);

  await client.query("COMMIT");
  console.log("Migration complete: places, categories, documents ready; appliances extended.");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  throw err;
} finally {
  await client.end();
}
