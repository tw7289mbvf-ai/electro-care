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
  // Optional postal address, entered once so intervention requests carry it without
  // retyping (spec "Postal address, optional"). Never selected by the admin queries below.
  await client.query(`ALTER TABLE places ADD COLUMN IF NOT EXISTS street_address TEXT`);
  await client.query(`ALTER TABLE places ADD COLUMN IF NOT EXISTS address_complement TEXT`);
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

  // Complet is dropped as a level (its tasks now sit in Recommandé, seed/README.md
  // "level"): existing places at 'complete' move to 'recommended' before the
  // constraint below stops accepting 'complete' at all. Must run before that ALTER,
  // or the ADD CONSTRAINT fails validating any row still at 'complete'.
  const COMPLETE_LEVEL_MIGRATION = "2026-09-drop-complete-maintenance-level";
  const [{ exists: completeLevelDone }] = (
    await client.query(`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name = $1) AS exists`, [COMPLETE_LEVEL_MIGRATION])
  ).rows;
  if (!completeLevelDone) {
    const { rowCount } = await client.query(
      `UPDATE places SET maintenance_level = 'recommended' WHERE maintenance_level = 'complete'`
    );
    await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [COMPLETE_LEVEL_MIGRATION]);
    console.log(`Complete maintenance level migration: ${rowCount} place(s) moved to recommended.`);
  }

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
  // Warranty end date (spec "Import from Invoices (planned)"): an invoice provides it
  // directly, so it's tracked in field_sources like purchase_date rather than derived
  // from purchase_date + a guessed duration.
  await client.query(`ALTER TABLE appliances ADD COLUMN IF NOT EXISTS warranty_end DATE`);

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
  // "C'est fait" window (spec's "Managing Appliances"): who did the intervention, for the
  // household's own history ("Fait en octobre 2026 par Chauffage Dupont"). Deliberately
  // never selected by admin_obligation_rows() below or any other admin-facing query —
  // the admin surface stays limited to counts and account-level metadata (spec/privacy
  // policy: "Jamais le contenu de vos lieux").
  await client.query(`ALTER TABLE appliance_obligations ADD COLUMN IF NOT EXISTS provider_name TEXT`);
  await client.query(`ALTER TABLE appliance_obligations ADD COLUMN IF NOT EXISTS provider_contact TEXT`);
  // "Modifier" on a past intervention (spec's "Managing Appliances"): set only by the
  // edit flow, never by the original "C'est fait"/"Mettre à jour" write, so the fiche can
  // show "modifiée le …" solely for a record someone went back and corrected.
  await client.query(`ALTER TABLE appliance_obligations ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ`);
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

  // History, never overwritten (spec's "Managing Appliances"): every "C'est fait" for a
  // legal obligation appends its own row here instead of replacing the last one —
  // appliance_obligations above stays the *current* status the app computes from (kept
  // in sync with this table's latest row by src/app/actions.ts after every write), while
  // this table is what the fiche's history list actually reads. One row per calendar
  // month per (appliance, task): resubmitting the same month updates that month's own
  // row (e.g. a provider correction without going through "Modifier") rather than
  // duplicating it, same shape as maintenance_completions below.
  await client.query(`
    CREATE TABLE IF NOT EXISTS obligation_completions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appliance_id UUID NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
      maintenance_task_id TEXT NOT NULL,
      service_date DATE NOT NULL,
      provider_name TEXT,
      provider_contact TEXT,
      modified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (appliance_id, maintenance_task_id, service_date)
    )
  `);
  await client.query(`ALTER TABLE obligation_completions ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS obligation_completions_isolation ON obligation_completions`);
  await client.query(`
    CREATE POLICY obligation_completions_isolation ON obligation_completions
      FOR ALL
      USING (EXISTS (
        SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
        WHERE a.id = obligation_completions.appliance_id AND p.account_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
        WHERE a.id = obligation_completions.appliance_id AND p.account_id = auth.uid()
      ))
  `);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON obligation_completions TO authenticated`);

  // "Rendez-vous pris" (spec's "Managing Appliances"): one pending appointment per
  // (appliance, task), replacing itself on reschedule rather than accumulating history —
  // unlike obligation_completions above, this isn't a proof, just a future plan. Deleted
  // once resolved (the "a-t-il eu lieu ?" flow answers yes, by handing off to
  // markObligationDone, or no+annuler) or replaced (no+reprogrammer).
  await client.query(`
    CREATE TABLE IF NOT EXISTS obligation_appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appliance_id UUID NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
      maintenance_task_id TEXT NOT NULL,
      appointment_date DATE NOT NULL,
      provider_name TEXT NOT NULL,
      provider_contact TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (appliance_id, maintenance_task_id)
    )
  `);
  await client.query(`ALTER TABLE obligation_appointments ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS obligation_appointments_isolation ON obligation_appointments`);
  await client.query(`
    CREATE POLICY obligation_appointments_isolation ON obligation_appointments
      FOR ALL
      USING (EXISTS (
        SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
        WHERE a.id = obligation_appointments.appliance_id AND p.account_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
        WHERE a.id = obligation_appointments.appliance_id AND p.account_id = auth.uid()
      ))
  `);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON obligation_appointments TO authenticated`);

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
  // "Modifier" on a past realisation (spec's "Managing Appliances"): same rule as
  // appliance_obligations.modified_at above — set only by the edit flow.
  await client.query(`ALTER TABLE maintenance_completions ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ`);
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

  // "Reporter" (spec's monthly guidance): defers a lifespan task's guidance by one
  // calendar month at a time. origin_month is fixed at the first defer of a cycle
  // (untouched by the ON CONFLICT below) so canDeferMaintenanceTask can cap the total
  // shift at under one full frequency interval away from where the task was actually
  // due — cleared on completion (src/app/actions.ts markMaintenanceTaskDone) so a later
  // occurrence starts its own cycle instead of inheriting a spent one.
  await client.query(`
    CREATE TABLE IF NOT EXISTS maintenance_deferrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appliance_id UUID NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
      maintenance_task_id TEXT NOT NULL,
      origin_month TEXT NOT NULL,
      deferred_to_month TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (appliance_id, maintenance_task_id)
    )
  `);
  await client.query(`ALTER TABLE maintenance_deferrals ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS maintenance_deferrals_isolation ON maintenance_deferrals`);
  await client.query(`
    CREATE POLICY maintenance_deferrals_isolation ON maintenance_deferrals
      FOR ALL
      USING (EXISTS (
        SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
        WHERE a.id = maintenance_deferrals.appliance_id AND p.account_id = auth.uid()
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM appliances a JOIN places p ON p.id = a.place_id
        WHERE a.id = maintenance_deferrals.appliance_id AND p.account_id = auth.uid()
      ))
  `);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON maintenance_deferrals TO authenticated`);

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

  // Chantier "historique des interventions": every already-recorded legal obligation
  // becomes the first entry of its new obligation_completions history instead of
  // starting that history empty. ON CONFLICT DO NOTHING makes this re-runnable, but it
  // is still journaled so a later "C'est fait" that legitimately reuses the same month
  // (unlikely, but possible right after this migration runs) is never mistaken for an
  // already-seeded row on a second run.
  const OBLIGATION_HISTORY_SEED = "2026-09-30-obligation-completions-seed-history";
  const [{ exists: obligationHistorySeeded }] = (
    await client.query(`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name = $1) AS exists`, [OBLIGATION_HISTORY_SEED])
  ).rows;
  if (!obligationHistorySeeded) {
    const { rowCount } = await client.query(`
      INSERT INTO obligation_completions (appliance_id, maintenance_task_id, service_date, provider_name, provider_contact, modified_at)
      SELECT appliance_id, maintenance_task_id, last_service_date, provider_name, provider_contact, modified_at
      FROM appliance_obligations
      WHERE last_service_date IS NOT NULL
      ON CONFLICT (appliance_id, maintenance_task_id, service_date) DO NOTHING
    `);
    await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [OBLIGATION_HISTORY_SEED]);
    console.log(`Obligation history seed: ${rowCount} row(s) became each task's first history entry.`);
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
      action TEXT NOT NULL CHECK (action IN ('suspend', 'reactivate', 'delete', 'send_reset_link', 'view_compliance')),
      target_account_id UUID REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // 'view_compliance' (spec, "Compliance per account, for support"): each display of the
  // per-account compliance table, with no target — the journal records who looked, never
  // the emails on screen. Re-added for a database whose table predates this action.
  await client.query(`ALTER TABLE admin_actions DROP CONSTRAINT IF EXISTS admin_actions_action_check`);
  await client.query(`
    ALTER TABLE admin_actions ADD CONSTRAINT admin_actions_action_check
      CHECK (action IN ('suspend', 'reactivate', 'delete', 'send_reset_link', 'view_compliance'))
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

  // Anonymous obligation rows (appliance id, equipment type, power, task dates/
  // confidence — no name, brand, room, place or account) for every account at once, so
  // the app can recompute "obligations by status" with the exact same
  // getObligationsForAppliance logic the dashboard already uses, instead of duplicating
  // that logic in SQL. power_kw is a technical spec figure, not the provider contact
  // details barred from admin_obligation_rows() by the comment above (appliance_obligations
  // table) — it's needed here too, to resolve a conditional obligation's threshold the
  // same way the dashboard does.
  //
  // DROP first: CREATE OR REPLACE can't change a function's RETURNS TABLE columns.
  await client.query(`DROP FUNCTION IF EXISTS admin_obligation_rows()`);
  await client.query(`
    CREATE FUNCTION admin_obligation_rows()
    RETURNS TABLE (
      appliance_id UUID,
      equipment_type_id TEXT,
      power_kw NUMERIC,
      maintenance_task_id TEXT,
      last_service_date DATE,
      known_due_date DATE,
      service_confidence TEXT
    ) AS $func$
    BEGIN
      PERFORM _require_admin();
      RETURN QUERY
      SELECT a.id, a.equipment_type_id, a.power_kw, o.maintenance_task_id, o.last_service_date,
             o.known_due_date, o.service_confidence
      FROM appliances a
      LEFT JOIN appliance_obligations o ON o.appliance_id = a.id
      WHERE a.equipment_type_id IS NOT NULL;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_obligation_rows() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_obligation_rows() TO authenticated`);

  // Compliance per account, for support (spec, "Measuring the MVP"): the same anonymous
  // rows as admin_obligation_rows(), tagged with their account id, plus each account's
  // places count — one row per account even with no place or appliance, so every
  // account gets a line. Never a name, brand, room, address or email: the app turns
  // these rows into per-account status counts server-side (same logic as the dashboard
  // gauge) and only those counts ever reach the page. Excludes admin/test/cron accounts.
  await client.query(`DROP FUNCTION IF EXISTS admin_account_compliance_rows()`);
  await client.query(`
    CREATE FUNCTION admin_account_compliance_rows()
    RETURNS TABLE (
      account_id UUID,
      places_count BIGINT,
      appliance_id UUID,
      equipment_type_id TEXT,
      power_kw NUMERIC,
      maintenance_task_id TEXT,
      last_service_date DATE,
      known_due_date DATE,
      service_confidence TEXT
    ) AS $func$
    BEGIN
      PERFORM _require_admin();
      RETURN QUERY
      SELECT u.id,
        (SELECT COUNT(*) FROM places pc WHERE pc.account_id = u.id),
        a.id, a.equipment_type_id, a.power_kw, o.maintenance_task_id, o.last_service_date,
        o.known_due_date, o.service_confidence
      FROM neon_auth."user" u
      LEFT JOIN places p ON p.account_id = u.id
      LEFT JOIN appliances a ON a.place_id = p.id AND a.equipment_type_id IS NOT NULL
      LEFT JOIN appliance_obligations o ON o.appliance_id = a.id
      WHERE COALESCE(u.role, '') NOT IN ('admin', 'test', 'cron');
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_account_compliance_rows() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_account_compliance_rows() TO authenticated`);

  // Monthly activity (spec, "Monthly activity, aggregated" and "Compliance and activity
  // per account"): per account and per month over the last twelve, counts only —
  // legal interventions recorded ("C'est fait", obligation_completions), maintenance
  // tasks done (maintenance_completions) and overdue obligations brought up to date
  // (obligation_status_changed events, recorded since 2026-10-05). Bucketed on the date
  // the user recorded it (created_at, Paris time), never the month they declared.
  // The questionnaire never writes to either history table nor logs a status change, so
  // it is out by construction; the history seed's rows share its schema_migrations
  // applied_at exactly (same transaction's now()), which is how they're left out.
  // Excludes admin/test/cron accounts.
  await client.query(`DROP FUNCTION IF EXISTS admin_monthly_activity()`);
  await client.query(`
    CREATE FUNCTION admin_monthly_activity()
    RETURNS TABLE (
      account_id UUID,
      month TEXT,
      interventions BIGINT,
      maintenance_done BIGINT,
      overdue_resolved BIGINT
    ) AS $func$
    DECLARE
      since TIMESTAMPTZ := (date_trunc('month', now() AT TIME ZONE 'Europe/Paris') - interval '11 months')
        AT TIME ZONE 'Europe/Paris';
    BEGIN
      PERFORM _require_admin();
      RETURN QUERY
      WITH ev AS (
        SELECT p.account_id AS acc, oc.created_at AS ts, 'intervention' AS kind
        FROM obligation_completions oc
        JOIN appliances a ON a.id = oc.appliance_id
        JOIN places p ON p.id = a.place_id
        WHERE oc.created_at >= since
          AND NOT EXISTS (
            SELECT 1 FROM schema_migrations sm
            WHERE sm.name = '2026-09-30-obligation-completions-seed-history' AND sm.applied_at = oc.created_at
          )
        UNION ALL
        SELECT p.account_id, mc.created_at, 'maintenance'
        FROM maintenance_completions mc
        JOIN appliances a ON a.id = mc.appliance_id
        JOIN places p ON p.id = a.place_id
        WHERE mc.created_at >= since
        UNION ALL
        SELECT pe.account_id, pe.created_at, 'resolved'
        FROM product_events pe
        WHERE pe.event_type = 'obligation_status_changed' AND pe.created_at >= since
          AND pe.metadata ->> 'fromStatus' = 'overdue' AND pe.metadata ->> 'toStatus' = 'up_to_date'
      )
      SELECT ev.acc, to_char(ev.ts AT TIME ZONE 'Europe/Paris', 'YYYY-MM'),
        COUNT(*) FILTER (WHERE ev.kind = 'intervention'),
        COUNT(*) FILTER (WHERE ev.kind = 'maintenance'),
        COUNT(*) FILTER (WHERE ev.kind = 'resolved')
      FROM ev
      JOIN neon_auth."user" u ON u.id = ev.acc
      WHERE COALESCE(u.role, '') NOT IN ('admin', 'test', 'cron')
      GROUP BY ev.acc, to_char(ev.ts AT TIME ZONE 'Europe/Paris', 'YYYY-MM');
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_monthly_activity() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_monthly_activity() TO authenticated`);

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

  // --- Reminder emails & measurement (chantier "rappels par e-mail et mesure du MVP") ---

  // Per-account opt-out for reminder emails (spec's "Reminder Emails", "Opt-out") and
  // the one-time satisfaction survey state. unsubscribe_token is the capability used by
  // the footer link in every reminder email: it must resolve for a signed-out click, so
  // it is looked up directly by value (unsubscribe_by_token below), never through
  // auth.uid(). A row only exists once an account has either touched its reminder
  // preference or received a reminder; getAccountPreferences() lazily creates it with
  // defaults on first read — see cron_due_reminders's COALESCE below, which treats a
  // missing row as "on" to match the spec's "on by default" without depending on that.
  await client.query(`
    CREATE TABLE IF NOT EXISTS account_preferences (
      account_id UUID PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
      email_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
      unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
      satisfaction_response TEXT,
      satisfaction_comment TEXT,
      satisfaction_shown_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(`ALTER TABLE account_preferences DROP CONSTRAINT IF EXISTS account_preferences_satisfaction_response_check`);
  await client.query(`
    ALTER TABLE account_preferences ADD CONSTRAINT account_preferences_satisfaction_response_check
      CHECK (satisfaction_response IS NULL OR satisfaction_response IN ('very_disappointed', 'somewhat_disappointed', 'not_disappointed'))
  `);
  await client.query(`ALTER TABLE account_preferences ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS account_preferences_isolation ON account_preferences`);
  await client.query(`
    CREATE POLICY account_preferences_isolation ON account_preferences
      FOR ALL
      USING (account_id = auth.uid())
      WITH CHECK (account_id = auth.uid())
  `);
  await client.query(`GRANT SELECT, INSERT, UPDATE ON account_preferences TO authenticated`);

  // Product events for the "Measuring the MVP" KPI panel (spec's "Instrumentation"):
  // account_created, questionnaire_completed and multi_home_interest_clicked each mean
  // something exactly once per account — the partial unique indexes below make a retry
  // or an odd render timing a harmless no-op instead of inflating a count past 1.
  // INSERT-only: no account has a UI need to read its own events, and every read this
  // app needs goes through the admin/KPI SECURITY DEFINER functions further down,
  // always aggregated, never raw rows tied to an email.
  await client.query(`
    CREATE TABLE IF NOT EXISTS product_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(`ALTER TABLE product_events DROP CONSTRAINT IF EXISTS product_events_event_type_check`);
  await client.query(`
    ALTER TABLE product_events ADD CONSTRAINT product_events_event_type_check
      CHECK (event_type IN (
        'account_created', 'questionnaire_completed', 'obligation_done', 'appointment_booked',
        'reminder_sent', 'reminder_link_clicked', 'obligation_status_changed', 'multi_home_interest_clicked'
      ))
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS product_events_account_created_once
      ON product_events (account_id) WHERE event_type = 'account_created'
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS product_events_questionnaire_completed_once
      ON product_events (account_id) WHERE event_type = 'questionnaire_completed'
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS product_events_multi_home_interest_once
      ON product_events (account_id) WHERE event_type = 'multi_home_interest_clicked'
  `);
  await client.query(`ALTER TABLE product_events ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS product_events_insert_only ON product_events`);
  // The cron account is the one legitimate case of an account inserting an event on
  // behalf of a *different* account_id (reminder_sent, for the account that received
  // it) — allowed by the role check, never by auth.uid() = account_id for that case.
  // The check goes through a SECURITY DEFINER function: a policy runs as the caller, and
  // `authenticated` has no SELECT on neon_auth."user", so reading it inline made every
  // insert fail with "permission denied for table user", own events included.
  await client.query(`
    CREATE OR REPLACE FUNCTION _is_cron() RETURNS boolean AS $func$
      SELECT auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM neon_auth."user" WHERE id = auth.uid() AND role = 'cron'
      );
    $func$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION _is_cron() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION _is_cron() TO authenticated`);
  await client.query(`
    CREATE POLICY product_events_insert_only ON product_events
      FOR INSERT
      WITH CHECK (account_id = auth.uid() OR _is_cron())
  `);
  await client.query(`GRANT INSERT ON product_events TO authenticated`);

  // The one self-scoped read product_events needs outside admin: "has my own account
  // already logged event X" (e.g. the Settings "Ça m'intéresse" button, so it can show
  // "merci" instead of the button again after a reload). Scoped to auth.uid() only —
  // not a general-purpose read, still no way for an account to browse another's events.
  await client.query(`
    CREATE OR REPLACE FUNCTION has_logged_event(p_event_type TEXT) RETURNS BOOLEAN AS $func$
    BEGIN
      RETURN auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM product_events WHERE account_id = auth.uid() AND event_type = p_event_type
      );
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION has_logged_event(TEXT) FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION has_logged_event(TEXT) TO authenticated`);

  // One row per account per calendar day an email was (or would have been) sent —
  // UNIQUE (account_id, sent_date) is what "one e-mail par jour et par utilisateur au
  // plus" actually enforces. Deny-all + no GRANT at all (same pattern as admin_actions):
  // every access goes through the SECURITY DEFINER functions below, never a direct
  // query, so there is no direct path to try in the first place.
  await client.query(`
    CREATE TABLE IF NOT EXISTS reminder_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
      sent_date DATE NOT NULL,
      subject TEXT NOT NULL,
      html_body TEXT NOT NULL,
      payload JSONB NOT NULL,
      actually_sent BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (account_id, sent_date)
    )
  `);
  await client.query(`ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS reminder_logs_no_direct_access ON reminder_logs`);
  await client.query(`CREATE POLICY reminder_logs_no_direct_access ON reminder_logs FOR ALL USING (false) WITH CHECK (false)`);

  // Idempotency for the milestone schedule: UNIQUE (appliance_id, maintenance_task_id,
  // due_date, milestone) means once a cycle resolves (a later "C'est fait" moves the
  // due date forward), the old due date's milestones simply never match again — no
  // explicit invalidation needed. reminder_log_id is only set when the milestone was
  // actually folded into a sent/previewed email (see cron_mark_milestones_sent).
  await client.query(`
    CREATE TABLE IF NOT EXISTS reminder_schedule_sent (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      appliance_id UUID NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
      maintenance_task_id TEXT NOT NULL,
      due_date DATE NOT NULL,
      milestone TEXT NOT NULL,
      reminder_log_id UUID REFERENCES reminder_logs(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (appliance_id, maintenance_task_id, due_date, milestone)
    )
  `);
  await client.query(`ALTER TABLE reminder_schedule_sent DROP CONSTRAINT IF EXISTS reminder_schedule_sent_milestone_check`);
  await client.query(`
    ALTER TABLE reminder_schedule_sent ADD CONSTRAINT reminder_schedule_sent_milestone_check
      CHECK (milestone IN ('three_months', 'one_month', 'due_date', 'overdue_1', 'overdue_2', 'overdue_3'))
  `);
  await client.query(`ALTER TABLE reminder_schedule_sent ENABLE ROW LEVEL SECURITY`);
  await client.query(`DROP POLICY IF EXISTS reminder_schedule_sent_no_direct_access ON reminder_schedule_sent`);
  await client.query(`CREATE POLICY reminder_schedule_sent_no_direct_access ON reminder_schedule_sent FOR ALL USING (false) WITH CHECK (false)`);

  // "cron" means exactly one thing, the same way "admin" does: the `role` column Neon
  // Auth manages on neon_auth.user, set once on one dedicated account via `neonctl
  // neon-auth user set-role`. No id is hardcoded here or anywhere else in this file.
  await client.query(`
    CREATE OR REPLACE FUNCTION _require_cron() RETURNS void AS $func$
    BEGIN
      IF auth.uid() IS NULL OR NOT EXISTS (
        SELECT 1 FROM neon_auth."user" WHERE id = auth.uid() AND role = 'cron'
      ) THEN
        RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
      END IF;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION _require_cron() FROM PUBLIC`);

  // Candidate rows for the daily reminder job: one per tracked legal obligation that
  // has at least one history entry (no entry means no due date to count down from, so
  // it can never be a reminder candidate anyway). Due dates themselves are computed in
  // TypeScript from last_service_date/known_due_date/service_confidence, reusing
  // getObligationsForAppliance exactly like getAdminObligationCounts() already does —
  // duplicating that logic in SQL would mean duplicating the maintenance-task frequency
  // and conditional-power-threshold data that only exists in the app's seed files.
  // p_preview_only restricts to admin/test accounts (see the chantier's "while sending
  // is off" rule) — real accounts are neither read nor rendered anywhere until sending
  // is actually enabled. Returns the account's email (needed to actually call Brevo):
  // unlike the admin_* functions, which deliberately never expose it (spec: the admin
  // never sees account content), this is the automated cron job's own trust boundary,
  // not the admin's — the one human-facing exception, the /admin preview, reads from
  // admin_list_recent_reminder_logs() instead, which never selects an email at all.
  await client.query(`DROP FUNCTION IF EXISTS cron_due_reminders(BOOLEAN)`);
  await client.query(`
    CREATE FUNCTION cron_due_reminders(p_preview_only BOOLEAN)
    RETURNS TABLE (
      account_id UUID,
      account_email TEXT,
      place_id UUID,
      place_name TEXT,
      street_address TEXT,
      address_complement TEXT,
      commune TEXT,
      postcode TEXT,
      appliance_id UUID,
      appliance_name TEXT,
      brand TEXT,
      model TEXT,
      equipment_type_id TEXT,
      power_kw NUMERIC,
      maintenance_task_id TEXT,
      last_service_date DATE,
      known_due_date DATE,
      service_confidence TEXT,
      provider_contact TEXT,
      has_pending_appointment BOOLEAN,
      prior_milestones JSONB,
      unsubscribe_token UUID
    ) AS $func$
    BEGIN
      PERFORM _require_cron();
      -- Every account with at least one place gets a preferences row before this
      -- function reads unsubscribe_token below — a footer link needs a real token, not
      -- a null one, and getAccountPreferences()'s own lazy-create only runs when that
      -- account happens to visit Settings, which isn't guaranteed before its first
      -- reminder email. Same preview-only filter as the query below: while sending is
      -- off, a real account must not even get this row written.
      INSERT INTO account_preferences (account_id)
      SELECT DISTINCT p.account_id FROM places p
      JOIN neon_auth."user" u ON u.id = p.account_id
      WHERE NOT p_preview_only OR u.role IN ('admin', 'test')
      -- By constraint name: a bare (account_id) is ambiguous with this function's own
      -- RETURNS TABLE column of the same name (42702).
      ON CONFLICT ON CONSTRAINT account_preferences_pkey DO NOTHING;
      RETURN QUERY
      SELECT
        p.account_id, u.email, p.id, p.name, p.street_address, p.address_complement, p.commune, p.postcode,
        a.id, a.name, a.brand, a.model, a.equipment_type_id, a.power_kw,
        o.maintenance_task_id, o.last_service_date, o.known_due_date, o.service_confidence,
        (SELECT oc.provider_contact FROM obligation_completions oc
           WHERE oc.appliance_id = a.id AND oc.maintenance_task_id = o.maintenance_task_id
           ORDER BY oc.service_date DESC, oc.created_at DESC LIMIT 1),
        EXISTS (SELECT 1 FROM obligation_appointments oa
           WHERE oa.appliance_id = a.id AND oa.maintenance_task_id = o.maintenance_task_id),
        (SELECT COALESCE(jsonb_agg(rs.milestone), '[]'::jsonb) FROM reminder_schedule_sent rs
           WHERE rs.appliance_id = a.id AND rs.maintenance_task_id = o.maintenance_task_id),
        ap.unsubscribe_token
      FROM appliance_obligations o
      JOIN appliances a ON a.id = o.appliance_id
      JOIN places p ON p.id = a.place_id
      JOIN neon_auth."user" u ON u.id = p.account_id
      JOIN account_preferences ap ON ap.account_id = p.account_id
      WHERE ap.email_reminders_enabled
        AND (NOT p_preview_only OR u.role IN ('admin', 'test'));
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION cron_due_reminders(BOOLEAN) FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION cron_due_reminders(BOOLEAN) TO authenticated`);

  // p_id is generated in TypeScript (crypto.randomUUID()), not by the table's own
  // DEFAULT: the email body built just before this call already embeds /go/[logId]
  // links, so the id must be known before the row exists. On the rare case of two cron
  // runs landing on the same account+day, the row's id moves to the newer call's id
  // (the content is fully regenerated anyway); an already-delivered email's old links
  // would 404 via the 90-day/unknown-id check, same as any other expired link.
  await client.query(`
    CREATE OR REPLACE FUNCTION cron_save_reminder_log(
      p_id UUID, p_account_id UUID, p_sent_date DATE, p_subject TEXT, p_html_body TEXT, p_payload JSONB, p_actually_sent BOOLEAN
    ) RETURNS void AS $func$
    BEGIN
      PERFORM _require_cron();
      INSERT INTO reminder_logs (id, account_id, sent_date, subject, html_body, payload, actually_sent)
      VALUES (p_id, p_account_id, p_sent_date, p_subject, p_html_body, p_payload, p_actually_sent)
      ON CONFLICT (account_id, sent_date) DO UPDATE SET
        id = EXCLUDED.id, subject = EXCLUDED.subject, html_body = EXCLUDED.html_body,
        payload = EXCLUDED.payload, actually_sent = EXCLUDED.actually_sent;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION cron_save_reminder_log(UUID, UUID, DATE, TEXT, TEXT, JSONB, BOOLEAN) FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION cron_save_reminder_log(UUID, UUID, DATE, TEXT, TEXT, JSONB, BOOLEAN) TO authenticated`);

  // Only called when EMAIL_REMINDERS_SENDING_ENABLED is actually "true" (see the cron
  // route): while sending is off, nothing here is ever marked sent, so a tester's
  // already-overdue obligations don't have their relances silently consumed during the
  // disabled period — see this chantier's "while sending is off" rule.
  await client.query(`
    CREATE OR REPLACE FUNCTION cron_mark_milestones_sent(
      p_appliance_id UUID, p_maintenance_task_id TEXT, p_due_date DATE, p_milestones TEXT[], p_reminder_log_id UUID
    ) RETURNS void AS $func$
    BEGIN
      PERFORM _require_cron();
      INSERT INTO reminder_schedule_sent (appliance_id, maintenance_task_id, due_date, milestone, reminder_log_id)
      SELECT p_appliance_id, p_maintenance_task_id, p_due_date, m, p_reminder_log_id
      FROM unnest(p_milestones) AS m
      ON CONFLICT (appliance_id, maintenance_task_id, due_date, milestone) DO NOTHING;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION cron_mark_milestones_sent(UUID, TEXT, DATE, TEXT[], UUID) FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION cron_mark_milestones_sent(UUID, TEXT, DATE, TEXT[], UUID) TO authenticated`);

  await client.query(`
    CREATE OR REPLACE FUNCTION cron_purge_old_reminder_logs() RETURNS void AS $func$
    BEGIN
      PERFORM _require_cron();
      DELETE FROM reminder_logs WHERE created_at < now() - interval '90 days';
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION cron_purge_old_reminder_logs() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION cron_purge_old_reminder_logs() TO authenticated`);

  // The two public, capability-token routes behind every link in a reminder email
  // (src/app/go/[logId], src/app/api/unsubscribe/[token]): the unguessable id/token
  // itself is the capability, exactly like a password-reset link — these functions
  // never check which *account* is calling. They still run under the `cron`-role
  // session (src/lib/cron-auth.ts, reused by both routes): this Neon Auth instance's
  // `anonymous` Postgres role turned out to need real credentials this app doesn't
  // have for a genuinely sessionless connection (found during this chantier's
  // rollout — connecting as `anonymous@<host>` with no authToken fails with "missing
  // authentication credentials"), so `_require_cron()` is reused here as the
  // authorization gate for "a trusted server-side caller, not a specific account" —
  // the same role already used for the daily job, not a new concept.
  // get_reminder_log_payload returns only the one requested task's entry, never the
  // whole payload array, and only inside a 90-day window; past that or for an unknown
  // id it returns NULL either way, so nothing is leaked about whether an id existed.
  await client.query(`
    CREATE OR REPLACE FUNCTION get_reminder_log_payload(p_id UUID, p_task_index INT) RETURNS JSONB AS $func$
    DECLARE
      v_payload JSONB;
    BEGIN
      PERFORM _require_cron();
      SELECT payload -> p_task_index INTO v_payload
      FROM reminder_logs WHERE id = p_id AND created_at > now() - interval '90 days';
      RETURN v_payload;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION get_reminder_log_payload(UUID, INT) FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION get_reminder_log_payload(UUID, INT) TO authenticated`);

  await client.query(`
    CREATE OR REPLACE FUNCTION log_reminder_link_click(p_id UUID, p_task_index INT, p_target TEXT) RETURNS void AS $func$
    DECLARE
      v_account_id UUID;
    BEGIN
      PERFORM _require_cron();
      SELECT account_id INTO v_account_id FROM reminder_logs
      WHERE id = p_id AND created_at > now() - interval '90 days';
      IF v_account_id IS NOT NULL THEN
        INSERT INTO product_events (account_id, event_type, metadata)
        VALUES (v_account_id, 'reminder_link_clicked',
                jsonb_build_object('reminder_log_id', p_id, 'task_index', p_task_index, 'target', p_target));
      END IF;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION log_reminder_link_click(UUID, INT, TEXT) FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION log_reminder_link_click(UUID, INT, TEXT) TO authenticated`);

  await client.query(`
    CREATE OR REPLACE FUNCTION unsubscribe_by_token(p_token UUID) RETURNS void AS $func$
    BEGIN
      PERFORM _require_cron();
      UPDATE account_preferences SET email_reminders_enabled = false WHERE unsubscribe_token = p_token;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION unsubscribe_by_token(UUID) FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION unsubscribe_by_token(UUID) TO authenticated`);

  // Admin preview of reminder emails (spec: built but switched off until the Brevo
  // domain/account exist — "l'admin peut prévisualiser chaque e-mail dans /admin, sans
  // l'envoyer"). Permanently scoped to admin/test accounts, independently of
  // cron_due_reminders's own preview-only filter: the spec's "l'administrateur ne voit
  // jamais le contenu des comptes" must hold even once real sending is enabled and
  // reminder_logs starts getting written for real accounts too.
  await client.query(`
    CREATE OR REPLACE FUNCTION admin_list_recent_reminder_logs()
    RETURNS TABLE (
      id UUID, account_id UUID, sent_date DATE, subject TEXT, html_body TEXT,
      actually_sent BOOLEAN, created_at TIMESTAMPTZ
    ) AS $func$
    BEGIN
      PERFORM _require_admin();
      RETURN QUERY
      SELECT r.id, r.account_id, r.sent_date, r.subject, r.html_body, r.actually_sent, r.created_at
      FROM reminder_logs r
      JOIN neon_auth."user" u ON u.id = r.account_id
      WHERE u.role IN ('admin', 'test')
      ORDER BY r.created_at DESC LIMIT 50;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_list_recent_reminder_logs() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_list_recent_reminder_logs() TO authenticated`);

  // Multi-home breakdown (spec extension for this chantier): places-per-account for the
  // 1/2/3/>3 bucketing, together with the same "engaged within 30 days of
  // account_created" flag the activation/engagement KPI uses, so src/lib/admin-metrics.ts
  // can compute each bucket's own engagement rate without a second per-account query.
  // Excludes admin/test/cron so they never skew the distribution.
  await client.query(`DROP FUNCTION IF EXISTS admin_account_engagement()`);
  await client.query(`
    CREATE FUNCTION admin_account_engagement()
    RETURNS TABLE (account_id UUID, places_count BIGINT, engaged BOOLEAN) AS $func$
    BEGIN
      PERFORM _require_admin();
      RETURN QUERY
      SELECT p.account_id, COUNT(DISTINCT p.id),
        EXISTS (
          SELECT 1 FROM product_events created
          JOIN product_events action ON action.account_id = created.account_id
          WHERE created.account_id = p.account_id AND created.event_type = 'account_created'
            AND action.event_type IN ('obligation_done', 'appointment_booked')
            AND action.created_at <= created.created_at + interval '30 days'
        )
      FROM places p
      JOIN neon_auth."user" u ON u.id = p.account_id
      WHERE u.role NOT IN ('admin', 'test', 'cron')
      GROUP BY p.account_id;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_account_engagement() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_account_engagement() TO authenticated`);

  // Raw counts for the "Measuring the MVP" KPI panel (spec's six measurable
  // indicators — the seventh, business model, is tracked by hand). Percentages are
  // computed in TypeScript (src/lib/admin-metrics.ts) from these counts, the same way
  // admin.ts already composes getAdminObligationCounts() — not duplicated in SQL.
  // Every count below excludes role IN ('admin', 'test', 'cron') so neither the
  // admin's own account nor a leftover test account can skew a percentage.
  await client.query(`DROP FUNCTION IF EXISTS admin_kpi_counts()`);
  await client.query(`
    CREATE FUNCTION admin_kpi_counts()
    RETURNS TABLE (
      accounts_total BIGINT,
      accounts_questionnaire_completed BIGINT,
      accounts_engaged_30d BIGINT,
      accounts_eligible_for_retention BIGINT,
      accounts_retained_second_month BIGINT,
      reminders_sent BIGINT,
      reminders_followed_by_action_30d BIGINT,
      obligations_overdue_resolved_60d BIGINT,
      obligations_overdue_more_than_60d BIGINT,
      survey_responses_total BIGINT,
      survey_very_disappointed BIGINT
    ) AS $func$
    BEGIN
      PERFORM _require_admin();
      RETURN QUERY
      SELECT
        (SELECT COUNT(*) FROM neon_auth."user" WHERE role NOT IN ('admin', 'test', 'cron')),
        (SELECT COUNT(DISTINCT pe.account_id) FROM product_events pe
           JOIN neon_auth."user" u ON u.id = pe.account_id
           WHERE pe.event_type = 'questionnaire_completed' AND u.role NOT IN ('admin', 'test', 'cron')),
        (SELECT COUNT(DISTINCT created.account_id) FROM product_events created
           JOIN neon_auth."user" u ON u.id = created.account_id
           WHERE created.event_type = 'account_created' AND u.role NOT IN ('admin', 'test', 'cron')
             AND EXISTS (
               SELECT 1 FROM product_events action
               WHERE action.account_id = created.account_id
                 AND action.event_type IN ('obligation_done', 'appointment_booked')
                 AND action.created_at <= created.created_at + interval '30 days'
             )),
        -- "Eligible for retention" = account is at least 60 days old, so its second
        -- month has fully elapsed and isn't still in progress.
        (SELECT COUNT(*) FROM product_events created
           JOIN neon_auth."user" u ON u.id = created.account_id
           WHERE created.event_type = 'account_created' AND u.role NOT IN ('admin', 'test', 'cron')
             AND created.created_at <= now() - interval '60 days'),
        -- Approximation: account_activity keeps only the single most recent visit, not
        -- a full visit history, so "returned in the second month" is read as "most
        -- recent visit is at least 30 days after account creation" rather than a
        -- precise days-31-60 window.
        (SELECT COUNT(*) FROM product_events created
           JOIN neon_auth."user" u ON u.id = created.account_id
           JOIN account_activity aa ON aa.account_id = created.account_id
           WHERE created.event_type = 'account_created' AND u.role NOT IN ('admin', 'test', 'cron')
             AND created.created_at <= now() - interval '60 days'
             AND aa.last_seen_at >= created.created_at + interval '30 days'),
        (SELECT COUNT(*) FROM product_events pe
           JOIN neon_auth."user" u ON u.id = pe.account_id
           WHERE pe.event_type = 'reminder_sent' AND u.role NOT IN ('admin', 'test', 'cron')),
        (SELECT COUNT(*) FROM product_events reminder
           JOIN neon_auth."user" u ON u.id = reminder.account_id
           WHERE reminder.event_type = 'reminder_sent' AND u.role NOT IN ('admin', 'test', 'cron')
             AND EXISTS (
               SELECT 1 FROM product_events action
               WHERE action.account_id = reminder.account_id
                 AND action.event_type IN ('obligation_done', 'appointment_booked', 'obligation_status_changed')
                 AND action.created_at > reminder.created_at
                 AND action.created_at <= reminder.created_at + interval '30 days'
             )),
        (SELECT COUNT(*) FROM product_events pe
           JOIN neon_auth."user" u ON u.id = pe.account_id
           WHERE pe.event_type = 'obligation_status_changed' AND u.role NOT IN ('admin', 'test', 'cron')
             AND pe.metadata ->> 'fromStatus' = 'overdue' AND pe.metadata ->> 'toStatus' != 'overdue'
             AND pe.created_at >= now() - interval '60 days'),
        -- Still-overdue obligations known red for more than 60 days (via their last
        -- reminder_sent for that exact appliance/task): the "failed to keep the
        -- promise" side of the same ratio. Computed from reminder_sent metadata rather
        -- than a live status re-check, since this function must not join appliance
        -- content for every account (admin never sees appliance content).
        (SELECT COUNT(*) FROM (
           SELECT DISTINCT pe.metadata ->> 'applianceId' AS appliance_id, pe.metadata ->> 'maintenanceTaskId' AS task_id
           FROM product_events pe
           JOIN neon_auth."user" u ON u.id = pe.account_id
           WHERE pe.event_type = 'reminder_sent' AND u.role NOT IN ('admin', 'test', 'cron')
             AND pe.created_at <= now() - interval '60 days'
         ) AS old_reminders),
        (SELECT COUNT(*) FROM account_preferences ap
           JOIN neon_auth."user" u ON u.id = ap.account_id
           WHERE ap.satisfaction_response IS NOT NULL AND u.role NOT IN ('admin', 'test', 'cron')),
        (SELECT COUNT(*) FROM account_preferences ap
           JOIN neon_auth."user" u ON u.id = ap.account_id
           WHERE ap.satisfaction_response = 'very_disappointed' AND u.role NOT IN ('admin', 'test', 'cron'));
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  `);
  await client.query(`REVOKE ALL ON FUNCTION admin_kpi_counts() FROM PUBLIC`);
  await client.query(`GRANT EXECUTE ON FUNCTION admin_kpi_counts() TO authenticated`);

  await client.query("COMMIT");
  console.log("Migration complete: schema, RLS policies and grants ready.");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  throw err;
} finally {
  await client.end();
}
