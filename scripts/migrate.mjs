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

function sqlKeyList(entries) {
  return entries.map((e) => `'${e.key.toString().replace(/'/g, "''")}'`).join(", ");
}

const client = new Client(databaseUrl);
await client.connect();

try {
  await client.query("BEGIN");

  // --- Roles ---------------------------------------------------------------
  //
  // neon_auth's JWKS registration already created authenticator/authenticated/anonymous
  // on this branch. neondb_owner owns every table below and BYPASSRLS, so it must never
  // be the role the running app queries with — only migrations and admin tasks use it.
  // The app queries as `authenticated` (a signed-in request, JWT carries the account's
  // user id) or `anonymous` (no session). Neither bypasses row-level security.

  await client.query(`GRANT USAGE ON SCHEMA public TO authenticated`);

  // --- Schema maintenance (idempotent, runs every time) --------------------

  // Journal for future one-time data conversions (reclassifying rows, backfills) that
  // must run exactly once, gated on nothing but their own name — see the pattern this
  // project used before the EU move. Nothing needs it yet: the database starts empty.
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS categories (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      sort_order INT NOT NULL,
      maintenance_plan BOOLEAN NOT NULL DEFAULT true
    )
  `);
  for (const category of categories) {
    await client.query(
      `INSERT INTO categories (key, label, sort_order, maintenance_plan) VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, maintenance_plan = EXCLUDED.maintenance_plan`,
      [category.key, category.label, category.order, category.maintenance_plan]
    );
  }
  // Reference data, not per-account: any signed-in user may read it, RLS does not apply.
  await client.query(`GRANT SELECT ON categories TO authenticated`);

  // Every place belongs to exactly one account (neon_auth.user). This is the root of
  // isolation: every other table below reaches its account only by joining back to
  // places, so a place without an account, or an account_id that isn't checked by a
  // policy, would be a hole in every table at once. NOT NULL and the FK make an
  // orphaned place impossible; RLS makes an unfiltered read of another account's place
  // impossible even if application code forgets a WHERE clause.
  await client.query(`
    CREATE TABLE IF NOT EXISTS places (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      commune TEXT,
      postcode TEXT,
      property_type TEXT,
      onboarded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(`ALTER TABLE places DROP CONSTRAINT IF EXISTS places_property_type_check`);
  await client.query(`
    ALTER TABLE places ADD CONSTRAINT places_property_type_check
      CHECK (property_type IS NULL OR property_type IN (${sqlKeyList(enums.property_type)}))
  `);
  await client.query(`ALTER TABLE places ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS places_isolation ON places`);
  await client.query(`
    CREATE POLICY places_isolation ON places
      FOR ALL
      USING (account_id = auth.uid())
      WITH CHECK (account_id = auth.uid())
  `);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON places TO authenticated`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS appliances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      category TEXT NOT NULL REFERENCES categories(key),
      equipment_type_id TEXT,
      name TEXT,
      brand TEXT,
      model TEXT,
      serial_number TEXT,
      room TEXT,
      purchase_date DATE,
      manufacture_date DATE,
      power_kw NUMERIC,
      refrigerant TEXT,
      refrigerant_charge_kg NUMERIC,
      hermetically_sealed BOOLEAN,
      field_sources JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
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
  await client.query(`ALTER TABLE appliances DROP CONSTRAINT IF EXISTS appliances_field_sources_check`);
  await client.query(`
    ALTER TABLE appliances ADD CONSTRAINT appliances_field_sources_check
      CHECK (valid_field_sources(field_sources))
  `);
  await client.query(`ALTER TABLE appliances ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS appliances_isolation ON appliances`);
  await client.query(`
    CREATE POLICY appliances_isolation ON appliances
      FOR ALL
      USING (EXISTS (SELECT 1 FROM places p WHERE p.id = appliances.place_id AND p.account_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM places p WHERE p.id = appliances.place_id AND p.account_id = auth.uid()))
  `);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON appliances TO authenticated`);

  // One row per (appliance, legal maintenance task) actually tracked for that
  // appliance's equipment type. No row means "à planifier": this applies equally to
  // appliances created by the questionnaire and by manual/photo/invoice entry.
  await client.query(`
    CREATE TABLE IF NOT EXISTS appliance_obligations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appliance_id UUID NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
      maintenance_task_id TEXT NOT NULL,
      last_service_date DATE,
      known_due_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (appliance_id, maintenance_task_id)
    )
  `);
  await client.query(`ALTER TABLE appliance_obligations ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS appliance_obligations_isolation ON appliance_obligations`);
  await client.query(`
    CREATE POLICY appliance_obligations_isolation ON appliance_obligations
      FOR ALL
      USING (EXISTS (
        SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
        WHERE a.id = appliance_obligations.appliance_id AND p.account_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
        WHERE a.id = appliance_obligations.appliance_id AND p.account_id = auth.uid()
      ))
  `);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON appliance_obligations TO authenticated`);

  // A "to check" item from a "Je ne sais pas" answer (REGLE-02). question_label and
  // help are snapshotted from the questionnaire at answer time, not looked up live,
  // so a later edit to seed/onboarding_questionnaire.json can't change past answers.
  // Same question answered "Je ne sais pas" again for the same place (e.g. a reload
  // mid-questionnaire) touches this one row instead of adding a duplicate.
  await client.query(`
    CREATE TABLE IF NOT EXISTS place_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      question_label TEXT NOT NULL,
      help TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (place_id, question_id)
    )
  `);
  await client.query(`ALTER TABLE place_checks ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS place_checks_isolation ON place_checks`);
  await client.query(`
    CREATE POLICY place_checks_isolation ON place_checks
      FOR ALL
      USING (EXISTS (SELECT 1 FROM places p WHERE p.id = place_checks.place_id AND p.account_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM places p WHERE p.id = place_checks.place_id AND p.account_id = auth.uid()))
  `);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON place_checks TO authenticated`);

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
  // A document has no account_id of its own — it is only ever reached through the
  // appliances it's linked to via document_appliances, so isolation for SELECT/UPDATE/
  // DELETE follows that join. INSERT is deliberately left ungated (WITH CHECK true):
  // nothing links a brand-new document to an account until the first
  // document_appliances row exists, so a WITH CHECK on that join would reject the very
  // insert that creates it. This is not just a gap for the missing WITH CHECK: Postgres
  // also applies documents_select to any RETURNING clause on the INSERT (RETURNING
  // reads the new row back), and that policy requires an existing document_appliances
  // link — so `INSERT ... RETURNING id` fails RLS even for a legitimate owner, verified
  // against this exact schema. Neither the app nor a server action calls into
  // `documents` yet (upload isn't built); when it is, insert with an app-generated id
  // (skip RETURNING) and insert the document_appliances row in the same transaction,
  // most likely via a SECURITY DEFINER function so the pair is atomic under RLS.
  await client.query(`ALTER TABLE documents ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS documents_select ON documents`);
  await client.query(`
    CREATE POLICY documents_select ON documents
      FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM document_appliances da
        JOIN appliances a ON a.id = da.appliance_id
        JOIN places p ON p.id = a.place_id
        WHERE da.document_id = documents.id AND p.account_id = auth.uid()
      ))
  `);
  await client.query(`DROP POLICY IF EXISTS documents_modify ON documents`);
  await client.query(`
    CREATE POLICY documents_modify ON documents
      FOR DELETE
      USING (EXISTS (
        SELECT 1 FROM document_appliances da
        JOIN appliances a ON a.id = da.appliance_id
        JOIN places p ON p.id = a.place_id
        WHERE da.document_id = documents.id AND p.account_id = auth.uid()
      ))
  `);
  await client.query(`DROP POLICY IF EXISTS documents_insert ON documents`);
  await client.query(`CREATE POLICY documents_insert ON documents FOR INSERT WITH CHECK (true)`);
  await client.query(`GRANT SELECT, INSERT, DELETE ON documents TO authenticated`);

  await client.query(`ALTER TABLE document_appliances ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS document_appliances_isolation ON document_appliances`);
  await client.query(`
    CREATE POLICY document_appliances_isolation ON document_appliances
      FOR ALL
      USING (EXISTS (
        SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
        WHERE a.id = document_appliances.appliance_id AND p.account_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
        WHERE a.id = document_appliances.appliance_id AND p.account_id = auth.uid()
      ))
  `);
  await client.query(`GRANT SELECT, INSERT, DELETE ON document_appliances TO authenticated`);

  await client.query("COMMIT");
  console.log("Migration complete: schema, RLS policies and grants ready.");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  throw err;
} finally {
  await client.end();
}
