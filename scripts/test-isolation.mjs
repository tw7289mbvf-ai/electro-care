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
  const owner = neon(ownerUrl());
  const sqlA = sqlAs(a.token);
  const sqlB = sqlAs(b.token);

  // --- Setup: one row per table, owned by A -----------------------------
  const [place] = await owner`INSERT INTO places (account_id, name) VALUES (${a.accountId}, 'A place') RETURNING id`;
  const [appliance] = await owner`INSERT INTO appliances (place_id, category, name) VALUES (${place.id}, 'kitchen', 'A appliance') RETURNING id`;
  const [obligation] = await owner`INSERT INTO appliance_obligations (appliance_id, maintenance_task_id) VALUES (${appliance.id}, 'T-TEST') RETURNING id`;
  const [check] = await owner`INSERT INTO place_checks (place_id, question_id, question_label) VALUES (${place.id}, 'Q-TEST', 'test') RETURNING id`;
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
    ["INSERT document_appliances linking A's document to B's appliance", () => sqlB.query("INSERT INTO document_appliances (document_id, appliance_id) VALUES ($1, $2)", [document.id, applianceB.id])],
    ["UPDATE B's own appliance to attach it to A's place", () => sqlB.query("UPDATE appliances SET place_id = $1 WHERE id = $2", [place.id, applianceB.id])],
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
  for (const table of ["places", "appliances", "appliance_obligations", "place_checks", "documents", "document_appliances"]) {
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
  execSync(`npx --yes neonctl neon-auth user delete ${a.accountId} --project-id ${PROJECT_ID} --branch ${BRANCH}`, { stdio: "ignore" });
  execSync(`npx --yes neonctl neon-auth user delete ${b.accountId} --project-id ${PROJECT_ID} --branch ${BRANCH}`, { stdio: "ignore" });

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
