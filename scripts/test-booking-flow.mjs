#!/usr/bin/env node
// End-to-end check of the booking requests (spec "Booking Requests", step 1) with two
// throwaway accounts: an appointment confirmed through the professional's answer, then
// a quote sent to three professionals, two answers, one choice. Professionals' answers
// are applied as the database owner through _apply_booking_answer(), the same function
// the personal link and the admin's manual entry both call — the link's HTTP page is
// covered by scripts/test-pro-link.mjs against the deployed app.
//
// Required env: NEON_AUTH_BASE_URL, DATABASE_URL (the `authenticated`-role string),
// NEON_PROJECT_ID. Optional: NEON_BRANCH (default "main"), SKIP_HTTP=1.
// Both accounts are deleted at the end and their absence is checked by id.

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

async function startAppServer() {
  const port = await findFreePort();
  const child = spawn("npx", ["--yes", "next", "dev", "-p", String(port)], { cwd: new URL("..", import.meta.url).pathname, stdio: "pipe" });
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

async function signInLocally(base, email) {
  const res = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error(`Local sign-in failed for ${email}: ${res.status}`);
  return cookie;
}

const SLOTS = [
  { date: "2099-03-02", period: "morning" },
  { date: "2099-03-03", period: "afternoon" },
];

async function main() {
  const suffix = Date.now();
  const a = await createAccountAndToken(`test-booking-a-${suffix}@example.com`);
  const b = await createAccountAndToken(`test-booking-b-${suffix}@example.com`);
  console.log(`Throwaway accounts — A: ${a.accountId}  B: ${b.accountId}`);
  const owner = neon(ownerUrl());
  const sqlA = neon(DATABASE_URL, { authToken: a.token });
  const sqlB = neon(DATABASE_URL, { authToken: b.token });

  // --- A's home: a place in Bordeaux (covered by the seeded directory), a gas boiler
  // and a flue --------------------------------------------------------------
  const [place] = await sqlA`
    INSERT INTO places (account_id, name, commune, postcode, street_address)
    VALUES (auth.uid(), 'Maison test', 'Bordeaux', '33000', '12 rue du Test') RETURNING id
  `;
  const [boiler] = await sqlA`
    INSERT INTO appliances (place_id, category, equipment_type_id, brand, model)
    VALUES (${place.id}, 'heating_cooling', 'CH-01', 'Saunier Duval', 'Thema') RETURNING id
  `;
  const [flue] = await sqlA`INSERT INTO appliances (place_id, category, equipment_type_id) VALUES (${place.id}, 'heating_cooling', 'CH-07') RETURNING id`;

  // --- 1. Appointment: one professional, confirmed by the professional ------------
  const heating = await sqlA`SELECT * FROM list_bookable_professionals('chauffagiste', '33000', ARRAY['T-001'])`;
  record("Directory lists heating engineers for 33000", heating.length >= 1, `${heating.length} listed`);
  const [{ id: appointmentRequest }] = await sqlA`SELECT create_booking_request(${JSON.stringify({
    place_id: place.id,
    kind: "appointment",
    trade: "chauffagiste",
    first_available: false,
    phone: "06 00 00 00 00",
    comment: "Code portail 1234",
    slots: SLOTS,
    details: { brand: "Saunier Duval", model: "Thema", year: null, lastService: null, fuel: "Gaz", applianceKind: null, flueCount: null },
    items: [{ appliance_id: boiler.id, maintenance_task_id: "T-001", task_title: "Entretien annuel", appliance_label: "Chaudière gaz" }],
    recipients: [{ professional_id: heating[0].id }],
    consent: true,
  })}::jsonb) AS id`;
  const [sentA] = await sqlA`SELECT status, kind FROM booking_requests WHERE id = ${appointmentRequest}`;
  record("Appointment request created as 'sent'", sentA?.status === "sent" && sentA.kind === "appointment", sentA?.status);
  const recipientsA = await sqlA`SELECT id, status FROM booking_request_recipients WHERE request_id = ${appointmentRequest}`;
  record("One recipient, pending", recipientsA.length === 1 && recipientsA[0].status === "pending", `${recipientsA.length}`);
  const [tokenA] = await owner`SELECT token, expires_at > now() + interval '29 days' AS month_long FROM booking_recipient_tokens WHERE recipient_id = ${recipientsA[0].id}`;
  record("Recipient has a 30-day token", Boolean(tokenA?.token) && tokenA.month_long === true, undefined);
  const visibleToB = await sqlB`SELECT id FROM booking_requests WHERE id = ${appointmentRequest}`;
  record("B cannot read A's request", visibleToB.length === 0, `${visibleToB.length} row(s)`);
  const phoneReuse = await sqlA`SELECT phone FROM booking_requests ORDER BY created_at DESC LIMIT 1`;
  record("Last phone is reusable for the next form", phoneReuse[0]?.phone === "06 00 00 00 00", phoneReuse[0]?.phone);

  // A second request on the same obligation is refused while the first is open.
  let duplicateRefused = false;
  try {
    await sqlA`SELECT create_booking_request(${JSON.stringify({
      place_id: place.id, kind: "appointment", trade: "chauffagiste", phone: "06", consent: true, slots: SLOTS,
      items: [{ appliance_id: boiler.id, maintenance_task_id: "T-001", task_title: "x", appliance_label: "x" }],
      recipients: [{ professional_id: heating[0].id }],
    })}::jsonb)`;
  } catch (e) {
    duplicateRefused = String(e.message).includes("already requested");
  }
  record("Second request on an open obligation refused", duplicateRefused, undefined);

  // The professional confirms the first half-day at 9:00 (what /pro/<token> calls).
  await owner`SELECT _apply_booking_answer(${recipientsA[0].id}, 'confirm', '{"slot_index":0,"time":"09:00"}'::jsonb, 'link')`;
  const [confirmedA] = await sqlA`SELECT status, closed_at FROM booking_requests WHERE id = ${appointmentRequest}`;
  record("Appointment request confirmed and closed", confirmedA.status === "confirmed" && confirmedA.closed_at !== null, confirmedA.status);
  const [appt] = await sqlA`SELECT appointment_date::text AS appointment_date, provider_name FROM obligation_appointments WHERE appliance_id = ${boiler.id} AND maintenance_task_id = 'T-001'`;
  record("« Rendez-vous pris » created on the obligation", appt?.appointment_date === "2099-03-02" && appt.provider_name === heating[0].name, `${appt?.appointment_date} ${appt?.provider_name}`);

  // --- 2. Quote: three sweeps, two answers, one choice ---------------------------
  const sweeps = await sqlA`SELECT * FROM list_bookable_professionals('ramoneur', '33000', ARRAY['T-014'])`;
  record("Directory lists at least three chimney sweeps for 33000", sweeps.length >= 3, `${sweeps.length} listed`);
  const [{ id: quoteRequest }] = await sqlA`SELECT create_booking_request(${JSON.stringify({
    place_id: place.id,
    kind: "quote",
    trade: "ramoneur",
    phone: "06 00 00 00 00",
    slots: [...SLOTS, { date: "2099-03-04", period: "morning" }],
    details: { brand: null, model: null, year: null, lastService: null, fuel: null, applianceKind: "Poêle à bois ou insert", flueCount: "1" },
    items: [{ appliance_id: flue.id, maintenance_task_id: "T-014", task_title: "Ramonage mécanique du conduit", appliance_label: "Conduit de fumée" }],
    recipients: sweeps.slice(0, 3).map((p) => ({ professional_id: p.id })),
    consent: true,
  })}::jsonb) AS id`;
  // Same created_at for all three (one transaction): order by id so both reads agree.
  const quoteRecipients = await sqlA`SELECT id, provider_name FROM booking_request_recipients WHERE request_id = ${quoteRequest} ORDER BY id`;
  record("Quote request has three recipients", quoteRecipients.length === 3, `${quoteRecipients.length}`);
  await owner`SELECT _apply_booking_answer(${quoteRecipients[0].id}, 'quote', '{"price_eur":"95","date":"2099-03-10","time":"14:00"}'::jsonb, 'link')`;
  await owner`SELECT _apply_booking_answer(${quoteRecipients[1].id}, 'quote', '{"price_eur":"80","date":"2099-03-12"}'::jsonb, 'admin')`;
  const answered = await sqlA`SELECT status, price_eur FROM booking_request_recipients WHERE request_id = ${quoteRequest} AND status = 'quoted'`;
  record("Two quotes received (« 2 sur 3 »)", answered.length === 2, `${answered.length}`);
  const [openQuote] = await sqlA`SELECT status FROM booking_requests WHERE id = ${quoteRequest}`;
  record("Quote request still open while the user compares", openQuote.status === "sent", openQuote.status);

  await sqlA`SELECT choose_booking_answer(${quoteRecipients[1].id})`;
  const chosen = await sqlA`SELECT id, status FROM booking_request_recipients WHERE request_id = ${quoteRequest} ORDER BY id`;
  const statusOf = (id) => chosen.find((c) => c.id === id)?.status;
  record(
    "Chosen quote confirmed, the others not chosen",
    statusOf(quoteRecipients[1].id) === "confirmed" && statusOf(quoteRecipients[0].id) === "not_chosen" && statusOf(quoteRecipients[2].id) === "not_chosen",
    quoteRecipients.map((r) => statusOf(r.id)).join(",")
  );
  const [closedQuote] = await sqlA`SELECT status FROM booking_requests WHERE id = ${quoteRequest}`;
  record("Quote request confirmed", closedQuote.status === "confirmed", closedQuote.status);
  const [flueAppt] = await sqlA`SELECT appointment_date::text AS appointment_date, provider_name FROM obligation_appointments WHERE appliance_id = ${flue.id} AND maintenance_task_id = 'T-014'`;
  record("« Rendez-vous pris » created from the chosen quote", flueAppt?.appointment_date === "2099-03-12" && flueAppt.provider_name === quoteRecipients[1].provider_name, `${flueAppt?.appointment_date} ${flueAppt?.provider_name}`);

  const events = await owner`SELECT event_type, COUNT(*)::int AS n FROM product_events WHERE account_id = ${a.accountId} GROUP BY event_type ORDER BY event_type`;
  const counts = Object.fromEntries(events.map((e) => [e.event_type, e.n]));
  record(
    "Product events recorded",
    counts.booking_request_sent === 2 && counts.booking_confirmed === 2 && counts.quote_received === 2 && counts.quote_chosen === 1 && counts.appointment_booked === 2,
    JSON.stringify(counts)
  );

  // --- 3. A cancels a third request; the pages render for A over HTTP -----------
  const [{ id: cancelRequest }] = await sqlA`SELECT create_booking_request(${JSON.stringify({
    place_id: place.id, kind: "appointment", trade: "chauffagiste", first_available: true, phone: "06", consent: true, slots: SLOTS,
    items: [{ appliance_id: boiler.id, maintenance_task_id: "T-126", task_title: "x", appliance_label: "x" }], recipients: [],
  })}::jsonb) AS id`;
  await sqlA`SELECT cancel_booking_request(${cancelRequest})`;
  const [cancelled] = await sqlA`SELECT status FROM booking_requests WHERE id = ${cancelRequest}`;
  record("« Le premier disponible » request cancelled by the user", cancelled.status === "cancelled", cancelled.status);

  if (process.env.SKIP_HTTP !== "1") {
    const app = await startAppServer();
    try {
      const aCookie = await signInLocally(app.base, a.email);
      const pages = [
        ["/", (html) => html.includes("Maison test")],
        [`/places/${place.id}`, (html) => html.includes("Rendez-vous le") && !html.includes("Devis reçus")],
        [`/appliances/${boiler.id}`, (html) => html.includes("Rendez-vous le")],
        [`/requests/${quoteRequest}`, (html) => html.includes("Rendez-vous confirmé") && html.includes("Choisir") === false],
        [`/requests/${appointmentRequest}`, (html) => html.includes("Rendez-vous confirmé")],
        ["/settings", () => true],
      ];
      for (const [path, check] of pages) {
        const res = await fetch(`${app.base}${path}`, { headers: { Cookie: aCookie } });
        const html = await res.text();
        record(`GET ${path} as A`, res.status === 200 && check(html), `HTTP ${res.status}`);
      }
      // The form page itself, on the flue (its T-014 request is closed, so the row offers
      // « Prendre rendez-vous » again and the page lists the seeded sweeps).
      const form = await fetch(`${app.base}/places/${place.id}/booking/new?appliance=${flue.id}&task=T-014`, { headers: { Cookie: aCookie } });
      const formHtml = await form.text();
      record("Booking form renders with the directory", form.status === 200 && formHtml.includes("Demander un devis") && formHtml.includes(sweeps[0].name), `HTTP ${form.status}`);
    } finally {
      app.stop();
    }
  }

  // --- Cleanup: delete both accounts, then verify by id ---------------------------
  for (const id of [a.accountId, b.accountId]) {
    try {
      execSync(`npx --yes neonctl neon-auth user delete ${id} --project-id ${PROJECT_ID} --branch ${BRANCH}`, { stdio: "ignore" });
    } catch {
      console.error(`Delete by hand: npx neonctl neon-auth user delete ${id} --project-id ${PROJECT_ID} --branch ${BRANCH}`);
    }
  }
  const left = await owner`SELECT id FROM neon_auth."user" WHERE id = ANY(${[a.accountId, b.accountId]}::uuid[])`;
  record("Both throwaway accounts deleted (checked by id)", left.length === 0, `${left.length} left`);
  const leftRequests = await owner`SELECT id FROM booking_requests WHERE account_id = ANY(${[a.accountId, b.accountId]}::uuid[])`;
  record("Their booking requests cascaded away", leftRequests.length === 0, `${leftRequests.length} left`);

  const failures = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
  if (failures.length > 0) {
    for (const f of failures) console.log(`  - ${f.label}${f.detail ? " — " + f.detail : ""}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
