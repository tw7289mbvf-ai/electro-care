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
  // Essentiel by default for every place, including ones that existed before this
  // column: ADD COLUMN ... NOT NULL DEFAULT backfills every existing row with it in the
  // same statement, matching the spec's "Essentiel by default, including for existing
  // places" without a separate UPDATE.
  await client.query(`ALTER TABLE places ADD COLUMN IF NOT EXISTS maintenance_level TEXT NOT NULL DEFAULT 'essential'`);
  await client.query(`ALTER TABLE places DROP CONSTRAINT IF EXISTS places_maintenance_level_check`);
  await client.query(`
    ALTER TABLE places ADD CONSTRAINT places_maintenance_level_check
      CHECK (maintenance_level IN (${sqlKeyList(enums.maintenance_level)}))
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
      service_confidence TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (appliance_id, maintenance_task_id)
    )
  `);
  // Graded answer to a date question (REGLE-01) when there is no exact date: 'recent'
  // (à confirmer, orange), 'old' (en retard) and 'never' (jamais fait / je ne sais pas,
  // en retard prioritaire) mirror last_service_date's absence; 'compliant' (à jour,
  // vert, e.g. un puits déclaré) does too, on the up_to_date side. Column added
  // separately for a database that already had this table before service_confidence
  // existed.
  await client.query(`ALTER TABLE appliance_obligations ADD COLUMN IF NOT EXISTS service_confidence TEXT`);
  await client.query(`ALTER TABLE appliance_obligations DROP CONSTRAINT IF EXISTS appliance_obligations_service_confidence_check`);
  await client.query(`
    ALTER TABLE appliance_obligations ADD CONSTRAINT appliance_obligations_service_confidence_check
      CHECK (service_confidence IS NULL OR service_confidence IN ('recent', 'old', 'never', 'compliant'))
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

  // Lifespan maintenance is app-only (no email, no legal deadline): one row per
  // (appliance, task, calendar month) marks it done for that month. done_month in the
  // unique key means re-doing the same task next month is a new row, not an overwrite.
  await client.query(`
    CREATE TABLE IF NOT EXISTS maintenance_completions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appliance_id UUID NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
      maintenance_task_id TEXT NOT NULL,
      done_month TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (appliance_id, maintenance_task_id, done_month)
    )
  `);
  await client.query(`ALTER TABLE maintenance_completions ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS maintenance_completions_isolation ON maintenance_completions`);
  await client.query(`
    CREATE POLICY maintenance_completions_isolation ON maintenance_completions
      FOR ALL
      USING (EXISTS (
        SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
        WHERE a.id = maintenance_completions.appliance_id AND p.account_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
        WHERE a.id = maintenance_completions.appliance_id AND p.account_id = auth.uid()
      ))
  `);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON maintenance_completions TO authenticated`);

  // --- One-time data conversions (journaled in schema_migrations, run at most once) ---

  // T-083 changed meaning (chantier 1): it used to be the annual battery check, it is
  // now the 10-years-after-manufacture detector replacement. An existing row's
  // last_service_date meant "last battery change" under the old meaning — wrong under
  // the new one — so every existing T-083 row moves to orange (service_confidence
  // 'recent': manufacture date to confirm) instead of carrying that stale date forward.
  const T083_MIGRATION = "2026-09-t083-manufacture-date-orange";
  const [{ exists: t083Done }] = (
    await client.query(`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name = $1) AS exists`, [T083_MIGRATION])
  ).rows;
  if (!t083Done) {
    const { rowCount } = await client.query(`
      UPDATE appliance_obligations
      SET last_service_date = NULL, known_due_date = NULL, service_confidence = 'recent'
      WHERE maintenance_task_id = 'T-083'
    `);
    await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [T083_MIGRATION]);
    console.log(`T-083 data migration: ${rowCount} row(s) moved to orange (manufacture date to confirm).`);
  }

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

  // A document belongs to an account directly (not only through the appliances it's
  // linked to): an earlier version isolated it purely via document_appliances, which
  // meant linking *any* document id to one of your own appliances made it readable —
  // account_id is what actually stops that, verified against this exact schema before
  // this column existed.
  await client.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
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
  await client.query(`ALTER TABLE documents ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS documents_isolation ON documents`);
  await client.query(`
    CREATE POLICY documents_isolation ON documents
      FOR ALL
      USING (account_id = auth.uid())
      WITH CHECK (account_id = auth.uid())
  `);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO authenticated`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS document_appliances (
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      appliance_id UUID NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
      PRIMARY KEY (document_id, appliance_id)
    )
  `);
  // Linking a document to an appliance must never be usable to reach into someone
  // else's document: the check requires the account to already own *both* sides, not
  // just the appliance side — owning an appliance is not consent to expose whatever
  // document id someone else supplies.

  await client.query(`ALTER TABLE document_appliances ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS document_appliances_isolation ON document_appliances`);
  await client.query(`
    CREATE POLICY document_appliances_isolation ON document_appliances
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
          WHERE a.id = document_appliances.appliance_id AND p.account_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM documents d
          WHERE d.id = document_appliances.document_id AND d.account_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
          WHERE a.id = document_appliances.appliance_id AND p.account_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM documents d
          WHERE d.id = document_appliances.document_id AND d.account_id = auth.uid()
        )
      )
  `);
  await client.query(`GRANT SELECT, INSERT, DELETE ON document_appliances TO authenticated`);

  // --- Admin & RGPD (chantier 3) --------------------------------------------

  // "Dernière connexion" / "actifs sur 30 jours" for the admin dashboard: better-auth
  // does not track last sign-in on the user record, so the app touches its own row on
  // each visit to the dashboard. RLS keeps every account able to write only its own row
  // (same isolation shape as every other per-account table); the admin's aggregate read
  // goes through admin_account_activity() below, never through a bypass-RLS connection.
  await client.query(`
    CREATE TABLE IF NOT EXISTS account_activity (
      account_id UUID PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(`ALTER TABLE account_activity ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS account_activity_isolation ON account_activity`);
  await client.query(`
    CREATE POLICY account_activity_isolation ON account_activity
      FOR ALL
      USING (account_id = auth.uid())
      WITH CHECK (account_id = auth.uid())
  `);
  await client.query(`GRANT SELECT, INSERT, UPDATE ON account_activity TO authenticated`);

  // Admin action journal (who/what/when). RLS denies every row to every account,
  // including the admin's own ordinary session: all access goes through the
  // SECURITY DEFINER functions below, which run as the table owner and enforce the
  // admin check themselves before touching a row. Cascading on both actor and target
  // means a deleted account (self-service or admin-deleted) leaves no trace here, even
  // of its own deletion — the right to erasure extends to the audit trail.
  await client.query(`
    CREATE TABLE IF NOT EXISTS admin_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_account_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK (action IN ('suspend', 'reactivate', 'delete', 'send_reset_link')),
      target_account_id UUID REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(`ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS admin_actions_no_direct_access ON admin_actions`);
  await client.query(`
    CREATE POLICY admin_actions_no_direct_access ON admin_actions FOR ALL USING (false) WITH CHECK (false)
  `);
  // Deliberately no GRANT to authenticated: the policy above would block rows anyway,
  // but not granting table privileges at all means there is no direct path to try.

  // Internal helper: not reachable by any role but its owner. It must never be granted
  // to `authenticated` directly, or any signed-in account could call it standalone —
  // it only ever runs from inside the SECURITY DEFINER functions below, which already
  // execute as the owner, so the internal call succeeds without a separate grant.
  // "admin" means exactly one thing: the `role` column Neon Auth manages on
  // neon_auth.user, set once via `neonctl neon-auth user set-role`. No id is
  // hardcoded here or anywhere else in this file.
  await client.query(`
    CREATE OR REPLACE FUNCTION _require_admin() RETURNS void AS $func$
    BEGIN
      IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM neon_auth."user" WHERE id = auth.uid() AND role = 'admin'
      ) THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
      END IF;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION _require_admin() FROM PUBLIC`);

  // Global figures without personal data. Account totals/new-in-7-days come from the
  // Neon Auth admin API in the app layer (its own admin-role check), not from here —
  // this function only aggregates our own tables, so it never needs to read
  // neon_auth.user's columns (whose exact casing this file doesn't otherwise assume).
  await client.query(`
    CREATE OR REPLACE FUNCTION admin_stats()
    RETURNS TABLE (
      accounts_active_30d BIGINT,
      places_total BIGINT,
      appliances_total BIGINT,
      questionnaires_completed BIGINT
    ) AS $func$
    BEGIN
      PERFORM _require_admin();
      RETURN QUERY
      SELECT
        (SELECT COUNT(*) FROM account_activity WHERE last_seen_at > now() - interval '30 days'),
        (SELECT COUNT(*) FROM places),
        (SELECT COUNT(*) FROM appliances),
        (SELECT COUNT(*) FROM places WHERE onboarded_at IS NOT NULL);
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_stats() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_stats() TO authenticated`);

  // Per-account counts for the admin account list: places and appliances only, never
  // their content (name, brand, room…), per the GDPR need-to-know principle in the spec.
  await client.query(`
    CREATE OR REPLACE FUNCTION admin_account_counts()
    RETURNS TABLE (account_id UUID, places_count BIGINT, appliances_count BIGINT) AS $func$
    BEGIN
      PERFORM _require_admin();
      RETURN QUERY
      SELECT p.account_id, COUNT(DISTINCT p.id), COUNT(a.id)
      FROM places p
      LEFT JOIN appliances a ON a.place_id = p.id
      GROUP BY p.account_id;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_account_counts() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_account_counts() TO authenticated`);

  await client.query(`
    CREATE OR REPLACE FUNCTION admin_account_activity()
    RETURNS TABLE (account_id UUID, last_seen_at TIMESTAMPTZ) AS $func$
    BEGIN
      PERFORM _require_admin();
      RETURN QUERY SELECT a.account_id, a.last_seen_at FROM account_activity a;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_account_activity() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_account_activity() TO authenticated`);

  // Anonymous obligation rows (appliance id, equipment type, task dates/confidence —
  // no name, brand, room, place or account) for every account at once, so the app can
  // recompute "obligations by status" with the exact same getObligationsForAppliance
  // logic the dashboard already uses, instead of duplicating that logic in SQL.
  await client.query(`
    CREATE OR REPLACE FUNCTION admin_obligation_rows()
    RETURNS TABLE (
      appliance_id UUID,
      equipment_type_id TEXT,
      maintenance_task_id TEXT,
      last_service_date DATE,
      known_due_date DATE,
      service_confidence TEXT
    ) AS $func$
    BEGIN
      PERFORM _require_admin();
      RETURN QUERY
      SELECT a.id, a.equipment_type_id, o.maintenance_task_id, o.last_service_date,
             o.known_due_date, o.service_confidence
      FROM appliances a
      LEFT JOIN appliance_obligations o ON o.appliance_id = a.id
      WHERE a.equipment_type_id IS NOT NULL;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_obligation_rows() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_obligation_rows() TO authenticated`);

  await client.query(`
    CREATE OR REPLACE FUNCTION admin_log_action(p_action TEXT, p_target_account_id UUID)
    RETURNS void AS $func$
    BEGIN
      PERFORM _require_admin();
      INSERT INTO admin_actions (actor_account_id, action, target_account_id)
      VALUES (auth.uid(), p_action, p_target_account_id);
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_log_action(TEXT, UUID) FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_log_action(TEXT, UUID) TO authenticated`);

  await client.query(`
    CREATE OR REPLACE FUNCTION admin_list_actions()
    RETURNS TABLE (
      id UUID, actor_account_id UUID, action TEXT, target_account_id UUID, created_at TIMESTAMPTZ
    ) AS $func$
    BEGIN
      PERFORM _require_admin();
      RETURN QUERY
      SELECT a.id, a.actor_account_id, a.action, a.target_account_id, a.created_at
      FROM admin_actions a ORDER BY a.created_at DESC LIMIT 200;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_list_actions() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_list_actions() TO authenticated`);

  // --- Account requests (chantier 4): deletion requests and contact messages, one
  // table for both since the admin page shows them together ("Demandes"). The owning
  // account can read and create its own rows (so "Paramètres" can show "already sent"
  // and so test-isolation.mjs can prove an account never sees another's), but only
  // SELECT/INSERT are granted: handled_at is admin-only, set through
  // admin_mark_request_handled below, never by the submitting account itself.
  await client.query(`
    CREATE TABLE IF NOT EXISTS account_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('deletion', 'contact')),
      email TEXT NOT NULL,
      message TEXT,
      handled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT account_requests_message_shape CHECK (
        (kind = 'contact' AND message IS NOT NULL) OR (kind = 'deletion' AND message IS NULL)
      )
    )
  `);
  await client.query(`ALTER TABLE account_requests ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS account_requests_isolation ON account_requests`);
  await client.query(`
    CREATE POLICY account_requests_isolation ON account_requests
      FOR ALL
      USING (account_id = auth.uid())
      WITH CHECK (account_id = auth.uid())
  `);
  await client.query(`GRANT SELECT, INSERT ON account_requests TO authenticated`);

  await client.query(`
    CREATE OR REPLACE FUNCTION admin_list_requests()
    RETURNS TABLE (
      id UUID, account_id UUID, kind TEXT, email TEXT, message TEXT,
      handled_at TIMESTAMPTZ, created_at TIMESTAMPTZ
    ) AS $func$
    BEGIN
      PERFORM _require_admin();
      RETURN QUERY
      SELECT r.id, r.account_id, r.kind, r.email, r.message, r.handled_at, r.created_at
      FROM account_requests r ORDER BY r.created_at DESC LIMIT 200;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_list_requests() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_list_requests() TO authenticated`);

  await client.query(`
    CREATE OR REPLACE FUNCTION admin_mark_request_handled(p_id UUID) RETURNS void AS $func$
    BEGIN
      PERFORM _require_admin();
      UPDATE account_requests SET handled_at = now() WHERE id = p_id;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_mark_request_handled(UUID) FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_mark_request_handled(UUID) TO authenticated`);

  await client.query("COMMIT");
  console.log("Migration complete: schema, RLS policies and grants ready.");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  throw err;
} finally {
  await client.end();
}
