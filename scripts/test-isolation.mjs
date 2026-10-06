#!/usr/bin/env node
// Adversarial per-account isolation test. Run against a disposable Neon branch/project,
// never against the real production database — it creates and deletes two throwaway
// accounts and cascades their data away at the end, but a bug in that cleanup should
// never be able to touch real rows.
//
// Required env: NEON_AUTH_BASE_URL, DATABASE_URL (the `authenticated`-role connection
// string the app itself uses), NEON_PROJECT_ID. Optional: NEON_BRANCH (default "main"),
// SKIP_HTTP_ISOLATION=1 to skip the /admin HTTP checks (they spawn `next dev` locally
// against this same DATABASE_URL/NEON_AUTH_BASE_URL — needs the app buildable at cwd).
//
// Usage: node scripts/test-isolation.mjs

import { execSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { neon } from "@neondatabase/serverless";

const AUTH_BASE = process.env.NEON_AUTH_BASE_URL;
const DATABASE_URL = process.env.DATABASE_URL;
const PROJECT_ID = process.env.NEON_PROJECT_ID;
const BRANCH = process.env.NEON_BRANCH ?? "main";

if (!AUTH_BASE || !DATABASE_URL || !PROJECT_ID) {
  throw new Error("NEON_AUTH_BASE_URL, DATABASE_URL and NEON_PROJECT_ID must be set");
}

const results = [];
function record(label, ok, detail) {
  results.push({ label, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
}

function ownerUrl() {
  return execSync(
    `npx --yes neonctl connection-string ${BRANCH} --project-id ${PROJECT_ID} --role-name neondb_owner --pooled`,
    { encoding: "utf8" }
  ).trim();
}

const TEST_PASSWORD = "TestPassword123!";

async function createAccountAndToken(email) {
  const password = TEST_PASSWORD;
  const signUp = await fetch(`${AUTH_BASE}/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password, name: email }),
  });
  const cookie = signUp.headers.get("set-cookie");
  const body = await signUp.json();
  if (!body.user?.id) throw new Error(`sign-up failed for ${email}: ${JSON.stringify(body)}`);
  const tokenRes = await fetch(`${AUTH_BASE}/token`, {
    headers: { Cookie: cookie ?? "", Origin: "http://localhost:3000" },
  });
  const { token } = await tokenRes.json();
  return { accountId: body.user.id, token };
}

function sqlAs(token) {
  return neon(DATABASE_URL, token ? { authToken: token } : undefined);
}

async function refused(fn) {
  try {
    const res = await fn();
    return { ok: res.length === 0, rows: res.length };
  } catch (e) {
    return { ok: true, code: e.code };
  }
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Spins up the app itself (next dev, against the same DATABASE_URL/NEON_AUTH_BASE_URL
// this script already uses) so /admin's notFound() and the admin/actions Route
// Handler's 404s can be proven over real HTTP, the same way a browser would see them —
// not just inferred from the underlying SQL/session checks.
async function startAppServer() {
  const port = await findFreePort();
  const child = spawn("npx", ["--yes", "next", "dev", "-p", String(port)], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "pipe",
  });
  const base = `http://localhost:${port}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      await fetch(base);
      return { base, stop: () => child.kill() };
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  child.kill();
  throw new Error(`App server did not become ready on ${base} within 60s`);
}

// Signs in through the app's OWN proxied auth route (not NEON_AUTH_BASE_URL directly)
// so the returned cookie is the one the app's middleware actually recognizes — the
// same cookie a real signed-in browser would carry.
async function signInLocally(base, email, password) {
  const res = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error(`Local sign-in failed for ${email}: ${res.status} ${await res.text()}`);
  return cookie;
}

async function main() {
  const suffix = Date.now();
  const a = await createAccountAndToken(`test-isolation-a-${suffix}@example.com`);
  const b = await createAccountAndToken(`test-isolation-b-${suffix}@example.com`);
  // Printed unconditionally, before anything that could throw: cleanup below runs with
  // stdio "ignore" (its own failure would otherwise pass silently), so these ids are
  // what a caller uses to delete the two throwaway accounts by hand if the run dies
  // before reaching cleanup, or if cleanup itself silently failed.
  console.log(`Throwaway accounts — A: ${a.accountId}  B: ${b.accountId}`);
  const owner = neon(ownerUrl());
  const sqlA = sqlAs(a.token);
  const sqlB = sqlAs(b.token);

  // --- Setup: one row per table, owned by A -----------------------------
  const [place] = await owner`INSERT INTO places (account_id, name) VALUES (${a.accountId}, 'A place') RETURNING id`;
  const [appliance] = await owner`INSERT INTO appliances (place_id, category, name) VALUES (${place.id}, 'kitchen', 'A appliance') RETURNING id`;
  const [obligation] = await owner`INSERT INTO appliance_obligations (appliance_id, maintenance_task_id) VALUES (${appliance.id}, 'T-TEST') RETURNING id`;
  const [obligationCompletion] = await owner`INSERT INTO obligation_completions (appliance_id, maintenance_task_id, service_date) VALUES (${appliance.id}, 'T-TEST', '2026-09-01') RETURNING id`;
  const [appointment] = await owner`INSERT INTO obligation_appointments (appliance_id, maintenance_task_id, appointment_date, provider_name) VALUES (${appliance.id}, 'T-TEST', '2099-01-01', 'A provider') RETURNING id`;
  const [check] = await owner`INSERT INTO place_checks (place_id, question_id, question_label) VALUES (${place.id}, 'Q-TEST', 'test') RETURNING id`;
  const [completion] = await owner`INSERT INTO maintenance_completions (appliance_id, maintenance_task_id, done_month) VALUES (${appliance.id}, 'T-TEST', '2026-09') RETURNING id`;
  const [deferral] = await owner`INSERT INTO maintenance_deferrals (appliance_id, maintenance_task_id, origin_month, deferred_to_month) VALUES (${appliance.id}, 'T-TEST', '2026-09', '2026-10') RETURNING id`;
  const [document] = await owner`INSERT INTO documents (account_id, document_type, storage_path) VALUES (${a.accountId}, 'invoice', '/test.pdf') RETURNING id`;
  await owner`INSERT INTO document_appliances (document_id, appliance_id) VALUES (${document.id}, ${appliance.id})`;
  const [request] = await owner`INSERT INTO account_requests (account_id, kind, email, message) VALUES (${a.accountId}, 'contact', 'a@example.com', 'A message') RETURNING id`;
  const [preferences] = await owner`INSERT INTO account_preferences (account_id) VALUES (${a.accountId}) RETURNING account_id, unsubscribe_token`;
  const reminderPayload = JSON.stringify([
    { applianceId: appliance.id, equipmentLabel: "Test", brand: null, model: null, taskTitle: "Test", legalBasis: null, placeAddress: null, providerEmail: null },
  ]);
  const [reminderLog] = await owner`
    INSERT INTO reminder_logs (account_id, sent_date, subject, html_body, payload)
    VALUES (${a.accountId}, '2026-10-01', 'Test', '<p>Test</p>', ${reminderPayload})
    RETURNING id
  `;
  const [scheduleSent] = await owner`
    INSERT INTO reminder_schedule_sent (appliance_id, maintenance_task_id, due_date, milestone)
    VALUES (${appliance.id}, 'T-TEST', '2026-10-01', 'due_date')
    RETURNING id
  `;

  // B's own legitimate resources, for the injection/reattachment tests
  const [placeB] = await sqlB`INSERT INTO places (account_id, name) VALUES (auth.uid(), 'B place') RETURNING id`;
  const [applianceB] = await sqlB`INSERT INTO appliances (place_id, category, name) VALUES (${placeB.id}, 'kitchen', 'B appliance') RETURNING id`;

  // --- 1. Read/write/delete A's rows by direct id, connected as B --------
  const targets = [
    { table: "places", id: place.id, col: "name" },
    { table: "appliances", id: appliance.id, col: "name" },
    { table: "appliance_obligations", id: obligation.id, col: "maintenance_task_id" },
    { table: "obligation_completions", id: obligationCompletion.id, col: "maintenance_task_id" },
    { table: "obligation_appointments", id: appointment.id, col: "provider_name" },
    { table: "place_checks", id: check.id, col: "question_label" },
    { table: "documents", id: document.id, col: "storage_path" },
    { table: "maintenance_completions", id: completion.id, col: "maintenance_task_id" },
    { table: "maintenance_deferrals", id: deferral.id, col: "deferred_to_month" },
    { table: "account_requests", id: request.id, col: "message" },
  ];
  for (const t of targets) {
    const sel = await refused(() => sqlB.query(`SELECT * FROM ${t.table} WHERE id = $1`, [t.id]));
    record(`SELECT ${t.table} (B → A's row)`, sel.ok, sel.rows !== undefined ? `${sel.rows} row(s)` : sel.code);
    const upd = await refused(() => sqlB.query(`UPDATE ${t.table} SET ${t.col} = 'PIRATE' WHERE id = $1`, [t.id]));
    record(`UPDATE ${t.table} (B → A's row)`, upd.ok, upd.rows !== undefined ? `${upd.rows} row(s)` : upd.code);
    const del = await refused(() => sqlB.query(`DELETE FROM ${t.table} WHERE id = $1`, [t.id]));
    record(`DELETE ${t.table} (B → A's row)`, del.ok, del.rows !== undefined ? `${del.rows} row(s)` : del.code);
  }
  // Positive control: A must still be able to read their own row — otherwise a
  // "refused everywhere" result could just mean everything is broken, not isolated.
  const ownRead = await sqlA`SELECT name FROM places WHERE id = ${place.id}`;
  record("SELECT own place (A → A's row, must succeed)", ownRead.length === 1, `${ownRead.length} row(s)`);
  const ownRequestRead = await sqlA`SELECT id FROM account_requests WHERE id = ${request.id}`;
  record("SELECT own account_requests row (A → A's row, must succeed)", ownRequestRead.length === 1, `${ownRequestRead.length} row(s)`);

  // account_preferences has no own `id` column (PK is account_id), so it's checked
  // separately rather than folded into the generic `targets` loop above.
  const apSel = await refused(() => sqlB.query("SELECT * FROM account_preferences WHERE account_id = $1", [preferences.account_id]));
  record("SELECT account_preferences (B → A's row)", apSel.ok, apSel.rows !== undefined ? `${apSel.rows} row(s)` : apSel.code);
  const apUpd = await refused(() =>
    sqlB.query("UPDATE account_preferences SET email_reminders_enabled = false WHERE account_id = $1", [preferences.account_id])
  );
  record("UPDATE account_preferences (B → A's row)", apUpd.ok, apUpd.rows !== undefined ? `${apUpd.rows} row(s)` : apUpd.code);
  const ownPrefRead = await sqlA`SELECT account_id FROM account_preferences WHERE account_id = ${preferences.account_id}`;
  record("SELECT own account_preferences row (A → A's row, must succeed)", ownPrefRead.length === 1, `${ownPrefRead.length} row(s)`);

  // reminder_logs / reminder_schedule_sent have no GRANT at all (deny-all, same
  // pattern as admin_actions) — any authenticated query against them must fail
  // regardless of row ownership, not just rows belonging to a different account.
  const rlSel = await refused(() => sqlB.query("SELECT * FROM reminder_logs WHERE id = $1", [reminderLog.id]));
  record("SELECT reminder_logs (B, no grant at all)", rlSel.ok, rlSel.rows !== undefined ? `${rlSel.rows} row(s)` : rlSel.code);
  const rssSel = await refused(() => sqlB.query("SELECT * FROM reminder_schedule_sent WHERE id = $1", [scheduleSent.id]));
  record("SELECT reminder_schedule_sent (B, no grant at all)", rssSel.ok, rssSel.rows !== undefined ? `${rssSel.rows} row(s)` : rssSel.code);

  const daSel = await refused(() => sqlB`SELECT * FROM document_appliances WHERE document_id = ${document.id}`);
  record("SELECT document_appliances (B → A's link)", daSel.ok);
  const daDel = await refused(() => sqlB`DELETE FROM document_appliances WHERE document_id = ${document.id}`);
  record("DELETE document_appliances (B → A's link)", daDel.ok);

  // --- 2. Insertion / reattachment attacks, connected as B ----------------
  const injections = [
    ["INSERT places with A's account_id", () => sqlB.query("INSERT INTO places (account_id, name) VALUES ($1, 'x')", [a.accountId])],
    ["INSERT appliances under A's place", () => sqlB.query("INSERT INTO appliances (place_id, category, name) VALUES ($1, 'kitchen', 'x')", [place.id])],
    ["INSERT appliance_obligations on A's appliance", () => sqlB.query("INSERT INTO appliance_obligations (appliance_id, maintenance_task_id) VALUES ($1, 'x')", [appliance.id])],
    ["INSERT obligation_completions on A's appliance", () => sqlB.query("INSERT INTO obligation_completions (appliance_id, maintenance_task_id, service_date) VALUES ($1, 'x', '2026-09-01')", [appliance.id])],
    ["INSERT obligation_appointments on A's appliance", () => sqlB.query("INSERT INTO obligation_appointments (appliance_id, maintenance_task_id, appointment_date, provider_name) VALUES ($1, 'x', '2099-01-01', 'PIRATE')", [appliance.id])],
    ["INSERT place_checks on A's place", () => sqlB.query("INSERT INTO place_checks (place_id, question_id, question_label) VALUES ($1, 'x', 'x')", [place.id])],
    ["INSERT maintenance_completions on A's appliance", () => sqlB.query("INSERT INTO maintenance_completions (appliance_id, maintenance_task_id, done_month) VALUES ($1, 'x', '2026-09')", [appliance.id])],
    ["INSERT maintenance_deferrals on A's appliance", () => sqlB.query("INSERT INTO maintenance_deferrals (appliance_id, maintenance_task_id, origin_month, deferred_to_month) VALUES ($1, 'x', '2026-09', '2026-10')", [appliance.id])],
    ["INSERT document_appliances linking A's document to B's appliance", () => sqlB.query("INSERT INTO document_appliances (document_id, appliance_id) VALUES ($1, $2)", [document.id, applianceB.id])],
    ["INSERT account_requests with A's account_id", () => sqlB.query("INSERT INTO account_requests (account_id, kind, email) VALUES ($1, 'deletion', 'pirate@example.com')", [a.accountId])],
    ["INSERT product_events with A's account_id", () => sqlB.query("INSERT INTO product_events (account_id, event_type) VALUES ($1, 'obligation_done')", [a.accountId])],
    ["UPDATE B's own appliance to attach it to A's place", () => sqlB.query("UPDATE appliances SET place_id = $1 WHERE id = $2", [place.id, applianceB.id])],
    // Dashboard actions (src/app/actions.ts): "Supprimer ce lieu" and "C'est fait",
    // attempted by B against A's rows. DELETE places is already covered generically
    // above (targets loop); this one mirrors deletePlace()'s exact statement. The
    // "C'est fait" case exercises setApplianceObligation()'s upsert shape specifically
    // — ON CONFLICT DO UPDATE evaluates the UPDATE's own USING/WITH CHECK on the
    // conflicting row, a different path than a plain INSERT or a plain UPDATE.
    ["DELETE A's place (deletePlace, B → A)", () => sqlB.query("DELETE FROM places WHERE id = $1", [place.id])],
    [
      "\"C'est fait\" upsert on A's appliance (markObligationDone, B → A)",
      () =>
        sqlB.query(
          `INSERT INTO appliance_obligations (appliance_id, maintenance_task_id, last_service_date)
           VALUES ($1, 'T-TEST', '2026-01-01')
           ON CONFLICT (appliance_id, maintenance_task_id) DO UPDATE SET
             last_service_date = EXCLUDED.last_service_date, known_due_date = NULL`,
          [appliance.id]
        ),
    ],
    [
      "\"C'est fait\" upsert on A's obligation_completions (markObligationDone, B → A)",
      () =>
        sqlB.query(
          `INSERT INTO obligation_completions (appliance_id, maintenance_task_id, service_date, provider_name, provider_contact)
           VALUES ($1, 'T-TEST', '2026-09-01', 'PIRATE', 'PIRATE')
           ON CONFLICT (appliance_id, maintenance_task_id, service_date) DO UPDATE SET
             provider_name = EXCLUDED.provider_name, provider_contact = EXCLUDED.provider_contact, modified_at = NULL`,
          [appliance.id]
        ),
    ],
    [
      "\"Reporter\" upsert on A's appliance (deferMaintenanceTask, B → A)",
      () =>
        sqlB.query(
          `INSERT INTO maintenance_deferrals (appliance_id, maintenance_task_id, origin_month, deferred_to_month)
           VALUES ($1, 'T-TEST', '2026-09', '2026-10')
           ON CONFLICT (appliance_id, maintenance_task_id) DO UPDATE SET
             deferred_to_month = EXCLUDED.deferred_to_month`,
          [appliance.id]
        ),
    ],
    [
      "\"Rendez-vous pris\"/\"Reprogrammer\" upsert on A's appliance (bookObligationAppointment, B → A)",
      () =>
        sqlB.query(
          `INSERT INTO obligation_appointments (appliance_id, maintenance_task_id, appointment_date, provider_name)
           VALUES ($1, 'T-TEST', '2099-06-01', 'PIRATE')
           ON CONFLICT (appliance_id, maintenance_task_id) DO UPDATE SET
             appointment_date = EXCLUDED.appointment_date, provider_name = EXCLUDED.provider_name`,
          [appliance.id]
        ),
    ],
  ];
  for (const [label, fn] of injections) {
    const res = await refused(fn);
    record(label, res.ok, res.rows !== undefined ? `${res.rows} row(s)` : res.code);
  }

  // The cross-account document read via a malicious link: already covered by the
  // "INSERT document_appliances linking A's document to B's appliance" refusal above,
  // but confirm the read is still blocked even if the link had somehow landed.
  const stillHidden = await refused(() => sqlB`SELECT id FROM documents WHERE id = ${document.id}`);
  record("SELECT A's document after injection attempt", stillHidden.ok);

  // --- 3. No session at all ------------------------------------------------
  for (const table of ["places", "appliances", "appliance_obligations", "obligation_completions", "obligation_appointments", "place_checks", "documents", "document_appliances", "maintenance_completions", "maintenance_deferrals", "account_requests", "account_preferences", "product_events", "reminder_logs", "reminder_schedule_sent"]) {
    const res = await refused(() => sqlAs(undefined).query(`SELECT * FROM ${table}`));
    record(`SELECT ${table} with no session token`, res.ok, res.code);
  }

  // --- 4. A's data intact, read back as owner ------------------------------
  const [checkPlace] = await owner`SELECT name FROM places WHERE id = ${place.id}`;
  record("A's place name unchanged", checkPlace.name === "A place", checkPlace.name);

  // --- 5. neondb_owner / bare DATABASE_URL usage in application code -------
  let ownerUsage = "";
  try {
    ownerUsage = execSync(`grep -rn "neondb_owner\\|neon(" src/ --include="*.ts" --include="*.tsx" | grep -v "^src/lib/db.ts"`, {
      encoding: "utf8",
      cwd: new URL("..", import.meta.url).pathname,
    });
  } catch {
    // grep exits 1 when it finds nothing — that's the success case here
  }
  record("No neondb_owner / bare neon() usage outside src/lib/db.ts", ownerUsage.trim() === "", ownerUsage.trim() || undefined);

  // --- 6. Admin SECURITY DEFINER functions, called directly as B (non-admin) --------
  // Same proof as the RLS checks above, but for the admin surface: the database itself
  // must refuse a non-admin caller, not just the app's own page/route-level checks.
  const adminFunctionCalls = [
    ["admin_stats()", () => sqlB`SELECT * FROM admin_stats()`],
    ["admin_account_counts()", () => sqlB`SELECT * FROM admin_account_counts()`],
    ["admin_account_activity()", () => sqlB`SELECT * FROM admin_account_activity()`],
    ["admin_obligation_rows()", () => sqlB`SELECT * FROM admin_obligation_rows()`],
    ["admin_account_compliance_rows()", () => sqlB`SELECT * FROM admin_account_compliance_rows()`],
    ["admin_monthly_activity()", () => sqlB`SELECT * FROM admin_monthly_activity()`],
    ["admin_log_action('view_compliance', NULL)", () => sqlB`SELECT admin_log_action('view_compliance', NULL)`],
    ["admin_list_actions()", () => sqlB`SELECT * FROM admin_list_actions()`],
    ["admin_log_action(...)", () => sqlB`SELECT admin_log_action('suspend', ${a.accountId})`],
    ["admin_list_requests()", () => sqlB`SELECT * FROM admin_list_requests()`],
    ["admin_mark_request_handled(...)", () => sqlB`SELECT admin_mark_request_handled(${request.id})`],
  ];
  for (const [label, fn] of adminFunctionCalls) {
    const res = await refused(fn);
    record(`${label} (B, not admin)`, res.ok, res.rows !== undefined ? `${res.rows} row(s)` : res.code);
  }

  // --- 6b. Cron-only SECURITY DEFINER functions, called directly as B (non-cron) -----
  // Includes get_reminder_log_payload/log_reminder_link_click/unsubscribe_by_token:
  // despite backing *public* routes (src/app/go/[logId], src/app/api/unsubscribe/
  // [token]), they gate on _require_cron() too — this Neon Auth instance's `anonymous`
  // role needs real credentials this app doesn't have for a genuinely sessionless
  // connection (found during this chantier's rollout), so those routes authenticate as
  // the `cron` account instead (src/lib/cron-auth.ts); the capability is still the
  // unguessable id/token itself, not this account, but the only thing provable here
  // without the real cron account's password is that a non-cron caller is refused —
  // same depth the admin_* checks below already test for admin.
  const cronFunctionCalls = [
    ["cron_due_reminders(false)", () => sqlB`SELECT * FROM cron_due_reminders(false)`],
    [
      "cron_save_reminder_log(...)",
      () => sqlB`SELECT cron_save_reminder_log(${reminderLog.id}, ${a.accountId}, '2026-10-01', 'x', 'x', '[]'::jsonb, false)`,
    ],
    [
      "cron_mark_milestones_sent(...)",
      () => sqlB`SELECT cron_mark_milestones_sent(${appliance.id}, 'T-TEST', '2026-10-01', ARRAY['due_date'], ${reminderLog.id})`,
    ],
    ["cron_purge_old_reminder_logs()", () => sqlB`SELECT cron_purge_old_reminder_logs()`],
    ["get_reminder_log_payload(...)", () => sqlB`SELECT get_reminder_log_payload(${reminderLog.id}, 0)`],
    ["log_reminder_link_click(...)", () => sqlB`SELECT log_reminder_link_click(${reminderLog.id}, 0, 'fiche')`],
    ["unsubscribe_by_token(...)", () => sqlB`SELECT unsubscribe_by_token(${preferences.unsubscribe_token})`],
  ];
  for (const [label, fn] of cronFunctionCalls) {
    const res = await refused(fn);
    record(`${label} (B, not cron)`, res.ok, res.rows !== undefined ? `${res.rows} row(s)` : res.code);
  }

  // --- 7. /admin and its actions over real HTTP, for a non-admin session and for no
  // session at all — both must answer 404, indistinguishable from a route that doesn't
  // exist. Skippable via SKIP_HTTP_ISOLATION=1 for a quick DB-only run.
  if (process.env.SKIP_HTTP_ISOLATION !== "1") {
    const app = await startAppServer();
    try {
      const bCookie = await signInLocally(app.base, `test-isolation-b-${suffix}@example.com`, TEST_PASSWORD);

      const httpChecks = [
        ["GET /admin, no session", () => fetch(`${app.base}/admin`)],
        ["GET /admin, B (not admin)", () => fetch(`${app.base}/admin`, { headers: { Cookie: bCookie } })],
        [
          "POST /admin/actions, no session",
          () =>
            fetch(`${app.base}/admin/actions`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Origin: app.base },
              body: JSON.stringify({ action: "suspend", accountId: a.accountId }),
            }),
        ],
        [
          "POST /admin/actions, B (not admin)",
          () =>
            fetch(`${app.base}/admin/actions`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Origin: app.base, Cookie: bCookie },
              body: JSON.stringify({ action: "suspend", accountId: a.accountId }),
            }),
        ],
      ];
      for (const [label, fn] of httpChecks) {
        const res = await fn();
        record(label, res.status === 404, `HTTP ${res.status}`);
      }
    } finally {
      app.stop();
    }
  } else {
    console.log("SKIP_HTTP_ISOLATION=1 — skipping /admin HTTP checks");
  }

  // --- Cleanup: delete both throwaway accounts, cascades everything -------
  // stdio was "ignore" — a failed delete here used to pass silently. Now each is
  // wrapped so a failure is printed loudly (with the id to delete by hand) instead of
  // disappearing, and one failing doesn't stop the other from being attempted.
  for (const [label, id] of [["A", a.accountId], ["B", b.accountId]]) {
    try {
      execSync(`npx --yes neonctl neon-auth user delete ${id} --project-id ${PROJECT_ID} --branch ${BRANCH}`, {
        stdio: "pipe",
      });
    } catch (e) {
      console.error(`CLEANUP FAILED for throwaway account ${label} (${id}): ${e.stderr?.toString() ?? e.message}`);
      console.error(`Delete by hand: npx neonctl neon-auth user delete ${id} --project-id ${PROJECT_ID} --branch ${BRANCH}`);
    }
  }

  const failures = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
  if (failures.length > 0) {
    console.log("FAILED:");
    for (const f of failures) console.log(`  - ${f.label}${f.detail ? " — " + f.detail : ""}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
