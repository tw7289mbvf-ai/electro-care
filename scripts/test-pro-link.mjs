#!/usr/bin/env node
// HTTP check of the professional's personal link (/pro/<token>, spec "The professional's
// answer") against the DEPLOYED app, so it needs none of the cron account's credentials
// locally: the deployment holds them. One throwaway account is created and given the
// admin role for the run (the links come from admin_booking_recipient_link(), the
// admin page's "Copier le lien"), it sends a quote request to three professionals and
// an appointment request to one, then the pages are fetched over HTTP:
//   - invalid, truncated or unknown token: 404;
//   - expired token: 404;
//   - a valid token shows its own request only, never another recipient;
//   - after the request is cancelled, and for a professional not chosen, the page shows
//     neither the address nor the phone number (nor the comment) any more;
//   - the response carries noindex.
// Nothing printed here is a token or a secret: only HTTP codes and account/row ids.
//
// Required env: NEON_AUTH_BASE_URL, DATABASE_URL (the `authenticated`-role string),
// NEON_PROJECT_ID. Optional: APP_URL (default: the Vercel team alias of the production
// deployment), NEON_BRANCH (default "main"). Before any token goes over the wire the
// script checks that APP_URL really serves Electro Care: `electro-care.vercel.app`,
// the obvious guess, belongs to someone else (found 2026-11-23) — a link sent to a
// wrong host would hand a live capability to a stranger.
// The account is deleted at the end and its absence is checked by id.

import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const AUTH_BASE = process.env.NEON_AUTH_BASE_URL;
const DATABASE_URL = process.env.DATABASE_URL;
const PROJECT_ID = process.env.NEON_PROJECT_ID;
const BRANCH = process.env.NEON_BRANCH ?? "main";
const APP_URL = (process.env.APP_URL ?? "https://electro-care-electro-care.vercel.app").replace(/\/$/, "");
if (!AUTH_BASE || !DATABASE_URL || !PROJECT_ID) {
  throw new Error("NEON_AUTH_BASE_URL, DATABASE_URL and NEON_PROJECT_ID must be set");
}

const results = [];
function record(label, ok, detail) {
  results.push({ label, ok, detail });
  console.log(`${ok ? "OK  " : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
}

function ownerUrl() {
  return execSync(`npx --yes neonctl connection-string ${BRANCH} --project-id ${PROJECT_ID} --role-name neondb_owner --pooled`, {
    encoding: "utf8",
  }).trim();
}

const TEST_PASSWORD = "TestPassword123!";

async function createAccountAndToken(email) {
  const signUp = await fetch(`${AUTH_BASE}/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password: TEST_PASSWORD, name: email }),
  });
  const cookie = signUp.headers.get("set-cookie");
  const body = await signUp.json();
  if (!body.user?.id) throw new Error(`sign-up failed for ${email}: ${JSON.stringify(body)}`);
  const tokenRes = await fetch(`${AUTH_BASE}/token`, { headers: { Cookie: cookie ?? "", Origin: "http://localhost:3000" } });
  const { token } = await tokenRes.json();
  return { accountId: body.user.id, token, email };
}

async function page(token) {
  const res = await fetch(`${APP_URL}/pro/${token}`, { redirect: "manual" });
  return { status: res.status, html: await res.text() };
}

const ADDRESS = "12 rue du Test Lien";
const PHONE = "06 12 34 56 78";
const COMMENT = "Code portail 9876";
const SLOTS = [
  { date: "2099-03-02", period: "morning" },
  { date: "2099-03-03", period: "afternoon" },
];

async function assertTargetIsElectroCare() {
  const res = await fetch(`${APP_URL}/`, { redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  if (!/<title>Electro Care<\/title>/.test(html)) {
    throw new Error(`${APP_URL} does not serve Electro Care (HTTP ${res.status}) — refusing to send any link there`);
  }
}

async function main() {
  await assertTargetIsElectroCare();
  const a = await createAccountAndToken(`test-pro-link-${Date.now()}@example.com`);
  console.log(`Throwaway account — ${a.accountId}  (target: ${APP_URL})`);
  const owner = neon(ownerUrl());
  const sqlA = neon(DATABASE_URL, { authToken: a.token });

  try {
    // The throwaway account is the admin for this run: the links are obtained the way
    // the admin page does it. The role lives on neon_auth.user and is read at call
    // time by _require_admin(), so the session token above stays valid.
    execSync(`npx --yes neonctl neon-auth user set-role ${a.accountId} --project-id ${PROJECT_ID} --branch ${BRANCH} --roles admin`, {
      stdio: "pipe",
    });
    const [roleRow] = await owner`SELECT role FROM neon_auth."user" WHERE id = ${a.accountId}`;
    record("Throwaway account carries the admin role for the run", roleRow?.role === "admin", roleRow?.role);

    // --- A's home: Bordeaux (covered by the seeded directory), a flue and a boiler ------
    const [place] = await sqlA`
      INSERT INTO places (account_id, name, commune, postcode, street_address)
      VALUES (auth.uid(), 'Maison test lien', 'Bordeaux', '33000', ${ADDRESS}) RETURNING id
    `;
    const [flue] = await sqlA`INSERT INTO appliances (place_id, category, equipment_type_id) VALUES (${place.id}, 'heating_cooling', 'CH-07') RETURNING id`;
    const [boiler] = await sqlA`INSERT INTO appliances (place_id, category, equipment_type_id) VALUES (${place.id}, 'heating_cooling', 'CH-01') RETURNING id`;

    // --- Quote request to three sweeps, appointment request to one heating engineer ------
    const sweeps = await sqlA`SELECT * FROM list_bookable_professionals('ramoneur', '33000', ARRAY['T-014'])`;
    record("Directory lists at least three chimney sweeps for 33000", sweeps.length >= 3, `${sweeps.length} listed`);
    const [{ id: quoteRequest }] = await sqlA`SELECT create_booking_request(${JSON.stringify({
      place_id: place.id, kind: "quote", trade: "ramoneur", phone: PHONE, comment: COMMENT, consent: true,
      slots: [...SLOTS, { date: "2099-03-04", period: "morning" }],
      details: { brand: null, model: null, year: null, lastService: null, fuel: null, applianceKind: "Poêle à bois ou insert", flueCount: "1" },
      items: [{ appliance_id: flue.id, maintenance_task_id: "T-014", task_title: "Ramonage test du conduit", appliance_label: "Conduit test" }],
      recipients: sweeps.slice(0, 3).map((p) => ({ professional_id: p.id })),
    })}::jsonb) AS id`;
    const quoteRecipients = await sqlA`SELECT id, provider_name FROM booking_request_recipients WHERE request_id = ${quoteRequest} ORDER BY id`;
    record("Quote request has three recipients", quoteRecipients.length === 3, `${quoteRecipients.length}`);
    const [r1, r2, r3] = quoteRecipients;

    const heating = await sqlA`SELECT * FROM list_bookable_professionals('chauffagiste', '33000', ARRAY['T-001'])`;
    record("Directory lists a heating engineer for 33000", heating.length >= 1, `${heating.length} listed`);
    const [{ id: appointmentRequest }] = await sqlA`SELECT create_booking_request(${JSON.stringify({
      place_id: place.id, kind: "appointment", trade: "chauffagiste", first_available: false, phone: PHONE, comment: COMMENT, consent: true,
      slots: SLOTS,
      details: { brand: null, model: null, year: null, lastService: null, fuel: "Gaz", applianceKind: null, flueCount: null },
      items: [{ appliance_id: boiler.id, maintenance_task_id: "T-001", task_title: "Entretien test de la chaudiere", appliance_label: "Chaudiere test" }],
      recipients: [{ professional_id: heating[0].id }],
    })}::jsonb) AS id`;
    const [r4] = await sqlA`SELECT id, provider_name FROM booking_request_recipients WHERE request_id = ${appointmentRequest}`;

    // --- Links through the admin "copy link" function (never printed) ---------------
    const tokens = new Map();
    for (const r of [r1, r2, r3, r4]) {
      const [row] = await sqlA`SELECT admin_booking_recipient_link(${r.id}) AS token`;
      tokens.set(r.id, row.token);
    }
    record("Four links obtained through admin_booking_recipient_link()", [...tokens.values()].every((t) => typeof t === "string" && t.length === 36), undefined);
    const [journal] = await sqlA`SELECT COUNT(*)::int AS n FROM admin_list_actions() WHERE action = 'copy_booking_link'`;
    record("Each copy is journaled", journal.n >= 4, `${journal.n} entries`);
    // The third sweep's token is put in the past, the way 30 days would.
    await owner`UPDATE booking_recipient_tokens SET expires_at = now() - interval '1 day' WHERE recipient_id = ${r3.id}`;

    // --- 404s ---------------------------------------------------------------------
    const invalid = await page("not-a-token");
    record("GET /pro/<invalid token>", invalid.status === 404, `HTTP ${invalid.status}`);
    const truncated = await page(tokens.get(r1.id).slice(0, 20));
    record("GET /pro/<truncated token>", truncated.status === 404, `HTTP ${truncated.status}`);
    const unknown = await page(randomUUID());
    record("GET /pro/<unknown token>", unknown.status === 404, `HTTP ${unknown.status}`);
    const expired = await page(tokens.get(r3.id));
    record("GET /pro/<expired token>", expired.status === 404, `HTTP ${expired.status}`);

    // --- A valid link: its own request only ---------------------------------------
    const others = [r2, r3, r4].map((r) => r.provider_name).filter((name) => !r1.provider_name.includes(name));
    const own = await page(tokens.get(r1.id));
    record("GET /pro/<valid token>", own.status === 200, `HTTP ${own.status}`);
    record("Valid link shows the request (address, phone, comment, prestation)", own.html.includes(ADDRESS) && own.html.includes(PHONE) && own.html.includes(COMMENT) && own.html.includes("Ramonage test du conduit"), undefined);
    record("Valid link names its professional", own.html.includes(r1.provider_name), undefined);
    record("Valid link never names another recipient", others.every((name) => !own.html.includes(name)), `${others.length} other names checked`);
    record("Valid link never shows the other request", !own.html.includes("Entretien test de la chaudiere"), undefined);
    record("Response carries noindex", own.status === 200 && /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(own.html), undefined);
    const second = await page(tokens.get(r2.id));
    record("GET /pro/<second valid token>", second.status === 200 && second.html.includes(r2.provider_name), `HTTP ${second.status}`);

    // --- Two quotes recorded by the admin, the first one chosen by the user ---------
    await sqlA`SELECT admin_record_booking_answer(${r1.id}, 'quote', '{"price_eur":"95","date":"2099-03-10"}'::jsonb)`;
    await sqlA`SELECT admin_record_booking_answer(${r2.id}, 'quote', '{"price_eur":"80","date":"2099-03-12"}'::jsonb)`;
    await sqlA`SELECT choose_booking_answer(${r1.id})`;
    const statuses = await sqlA`SELECT id, status FROM booking_request_recipients WHERE request_id = ${quoteRequest} ORDER BY id`;
    record("First sweep confirmed, the others not chosen", statuses.map((s) => s.status).join(",") === "confirmed,not_chosen,not_chosen", statuses.map((s) => s.status).join(","));

    const notChosen = await page(tokens.get(r2.id));
    record("Not chosen: page still answers", notChosen.status === 200, `HTTP ${notChosen.status}`);
    record("Not chosen: address, phone and comment are gone", !notChosen.html.includes(ADDRESS) && !notChosen.html.includes(PHONE) && !notChosen.html.includes(COMMENT), undefined);
    record("Not chosen: told the client retained another answer", notChosen.html.includes("retenu une autre réponse"), undefined);
    const chosen = await page(tokens.get(r1.id));
    record("Chosen: address and phone still shown (positive control)", chosen.status === 200 && chosen.html.includes(ADDRESS) && chosen.html.includes(PHONE), `HTTP ${chosen.status}`);

    // --- The appointment request is cancelled by the user --------------------------
    await sqlA`SELECT cancel_booking_request(${appointmentRequest})`;
    const cancelled = await page(tokens.get(r4.id));
    record("Cancelled: page still answers", cancelled.status === 200, `HTTP ${cancelled.status}`);
    record("Cancelled: address, phone and comment are gone", !cancelled.html.includes(ADDRESS) && !cancelled.html.includes(PHONE) && !cancelled.html.includes(COMMENT), undefined);
    record("Cancelled: told the client cancelled", cancelled.html.includes("a annulé cette demande"), undefined);
  } finally {
    // --- Cleanup: the account, then verify by id ---------------------------------
    try {
      execSync(`npx --yes neonctl neon-auth user delete ${a.accountId} --project-id ${PROJECT_ID} --branch ${BRANCH}`, { stdio: "pipe" });
    } catch (e) {
      console.error(`CLEANUP FAILED for throwaway account ${a.accountId}: ${e.stderr?.toString() ?? e.message}`);
      console.error(`Delete by hand: npx neonctl neon-auth user delete ${a.accountId} --project-id ${PROJECT_ID} --branch ${BRANCH}`);
    }
    const [left] = await owner`
      SELECT (SELECT COUNT(*) FROM neon_auth."user" WHERE id = ${a.accountId})::int AS accounts,
             (SELECT COUNT(*) FROM places WHERE account_id = ${a.accountId})::int AS places,
             (SELECT COUNT(*) FROM booking_requests WHERE account_id = ${a.accountId})::int AS requests,
             (SELECT COUNT(*) FROM admin_actions WHERE actor_account_id = ${a.accountId})::int AS actions,
             (SELECT COUNT(*) FROM product_events WHERE account_id = ${a.accountId})::int AS events
    `;
    record(
      "Throwaway account and its rows deleted (checked by id)",
      left.accounts === 0 && left.places === 0 && left.requests === 0 && left.actions === 0 && left.events === 0,
      `accounts ${left.accounts}, places ${left.places}, requests ${left.requests}, admin actions ${left.actions}, events ${left.events}`
    );
  }

  const failures = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
  if (failures.length > 0) {
    console.log("FAILED:");
    for (const f of failures) console.log(`  - ${f.label}${f.detail ? " — " + f.detail : ""}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
