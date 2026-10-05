import { getAuthedContext } from "@/lib/db";

// "Measuring the MVP" instrumentation (spec's "Instrumentation"): product events
// recorded in our own database, no cookie, no third-party tool. account_created,
// questionnaire_completed and multi_home_interest_clicked are enforced unique per
// account by a partial index in scripts/migrate.mjs — ON CONFLICT DO NOTHING makes a
// retry harmless instead of inflating a count.
export type ProductEventType =
  | "account_created"
  | "questionnaire_completed"
  | "obligation_done"
  | "appointment_booked"
  | "obligation_status_changed"
  | "multi_home_interest_clicked";

const UNIQUE_PER_ACCOUNT: ReadonlySet<ProductEventType> = new Set([
  "account_created",
  "questionnaire_completed",
  "multi_home_interest_clicked",
]);

export async function logProductEvent(
  eventType: ProductEventType,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const { sql, accountId } = await getAuthedContext();
  if (UNIQUE_PER_ACCOUNT.has(eventType)) {
    // The ON CONFLICT arbiter's predicate must match the partial index's predicate
    // (scripts/migrate.mjs) literally — Postgres doesn't accept a bound parameter
    // there, so eventType (a closed TS union, never raw user input) is inlined via
    // .query()'s imperative form instead of the sql`` tagged template.
    await sql.query(
      `INSERT INTO product_events (account_id, event_type, metadata)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id) WHERE event_type = '${eventType}' DO NOTHING`,
      [accountId, eventType, JSON.stringify(metadata)]
    );
    return;
  }
  await sql`
    INSERT INTO product_events (account_id, event_type, metadata)
    VALUES (${accountId}, ${eventType}, ${JSON.stringify(metadata)})
  `;
}

// Self-scoped read (has_logged_event checks account_id = auth.uid() internally) — not
// a general product_events read, see scripts/migrate.mjs.
export async function hasLoggedEvent(eventType: ProductEventType): Promise<boolean> {
  const { sql } = await getAuthedContext();
  const [row] = (await sql`SELECT has_logged_event(${eventType}) AS logged`) as { logged: boolean }[];
  return row?.logged ?? false;
}
