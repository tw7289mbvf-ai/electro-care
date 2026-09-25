#!/usr/bin/env node
// Adversarial per-account isolation test. Run against a disposable Neon branch/project,
// never against the real production database — it creates and deletes two throwaway
// accounts and cascades their data away at the end, but a bug in that cleanup should
// never be able to touch real rows.
//
// Required env: NEON_AUTH_BASE_URL, DATABASE_URL (the `authenticated`-role connection
// string the app itself uses), NEON_PROJECT_ID. Optional: NEON_BRANCH (default "main").
//
// Usage: node scripts/test-isolation.mjs

import { execSync } from "node:child_process";
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

async function createAccountAndToken(email) {
  const password = "TestPassword123!";
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
  const [check] = await owner`INSERT INTO place_checks (place_id, question_id, question_label) VALUES (${place.id}, 'Q-TEST', 'test') RETURNING id`;
  const [completion] = await owner`INSERT INTO maintenance_completions (appliance_id, maintenance_task_id, done_month) VALUES (${appliance.id}, 'T-TEST', '2026-09') RETURNING id`;
  const [document] = await owner`INSERT INTO documents (account_id, document_type, storage_path) VALUES (${a.accountId}, 'invoice', '/test.pdf') RETURNING id`;
  await owner`INSERT INTO document_appliances (document_id, appliance_id) VALUES (${document.id}, ${appliance.id})`;

  // B's own legitimate resources, for the injection/reattachment tests
  const [placeB] = await sqlB`INSERT INTO places (account_id, name) VALUES (auth.uid(), 'B place') RETURNING id`;
  const [applianceB] = await sqlB`INSERT INTO appliances (place_id, category, name) VALUES (${placeB.id}, 'kitchen', 'B appliance') RETURNING id`;

  // --- 1. Read/write/delete A's rows by direct id, connected as B --------
  const targets = [
    { table: "places", id: place.id, col: "name" },
    { table: "appliances", id: appliance.id, col: "name" },
    { table: "appliance_obligations", id: obligation.id, col: "maintenance_task_id" },
    { table: "place_checks", id: check.id, col: "question_label" },
    { table: "documents", id: document.id, col: "storage_path" },
    { table: "maintenance_completions", id: completion.id, col: "maintenance_task_id" },
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

  const daSel = await refused(() => sqlB`SELECT * FROM document_appliances WHERE document_id = ${document.id}`);
  record("SELECT document_appliances (B → A's link)", daSel.ok);
  const daDel = await refused(() => sqlB`DELETE FROM document_appliances WHERE document_id = ${document.id}`);
  record("DELETE document_appliances (B → A's link)", daDel.ok);

  // --- 2. Insertion / reattachment attacks, connected as B ----------------
  const injections = [
    ["INSERT places with A's account_id", () => sqlB.query("INSERT INTO places (account_id, name) VALUES ($1, 'x')", [a.accountId])],
    ["INSERT appliances under A's place", () => sqlB.query("INSERT INTO appliances (place_id, category, name) VALUES ($1, 'kitchen', 'x')", [place.id])],
    ["INSERT appliance_obligations on A's appliance", () => sqlB.query("INSERT INTO appliance_obligations (appliance_id, maintenance_task_id) VALUES ($1, 'x')", [appliance.id])],
    ["INSERT place_checks on A's place", () => sqlB.query("INSERT INTO place_checks (place_id, question_id, question_label) VALUES ($1, 'x', 'x')", [place.id])],
    ["INSERT maintenance_completions on A's appliance", () => sqlB.query("INSERT INTO maintenance_completions (appliance_id, maintenance_task_id, done_month) VALUES ($1, 'x', '2026-09')", [appliance.id])],
    ["INSERT document_appliances linking A's document to B's appliance", () => sqlB.query("INSERT INTO document_appliances (document_id, appliance_id) VALUES ($1, $2)", [document.id, applianceB.id])],
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
  for (const table of ["places", "appliances", "appliance_obligations", "place_checks", "documents", "document_appliances", "maintenance_completions"]) {
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
