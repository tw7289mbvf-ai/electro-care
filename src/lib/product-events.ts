import { getAuthedContext } from "@/lib/db";

// "Measuring the MVP" instrumentation (spec's "Instrumentation"): product events
// recorded in our own database, no cookie, no third-party tool. account_created,
// questionnaire_completed and multi_home_interest_clicked are enforced unique per
// account by a partial index in scripts/migrate.mjs — a retry is harmless instead of
// inflating a count (see insertProductEvent).
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

// A measurement must never break the page or action that records it: any failure is
// logged and swallowed, the caller carries on.
export async function logProductEvent(
  eventType: ProductEventType,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await insertProductEvent(eventType, metadata);
  } catch (error) {
    console.error(`product event "${eventType}" not recorded`, error);
  }
}

async function insertProductEvent(eventType: ProductEventType, metadata: Record<string, unknown>): Promise<void> {
  const { sql, accountId } = await getAuthedContext();
  if (UNIQUE_PER_ACCOUNT.has(eventType)) {
    // No ON CONFLICT here: its arbiter needs SELECT on product_events, which
    // `authenticated` deliberately doesn't have (42501 on every signed-in visit to "/",
    // found 2026-10-05). Check first through has_logged_event, and treat a unique
    // violation from a concurrent request as "already logged".
    if (await hasLoggedEvent(eventType)) return;
    try {
      await sql`
        INSERT INTO product_events (account_id, event_type, metadata)
        VALUES (${accountId}, ${eventType}, ${JSON.stringify(metadata)})
      `;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return;
      throw error;
    }
    return;
  }
  await sql`
    INSERT INTO product_events (account_id, event_type, metadata)
    VALUES (${accountId}, ${eventType}, ${JSON.stringify(metadata)})
  `;
}

// Self-scoped read (has_logged_event checks account_id = auth.uid() internally) — not
// a general product_events read, see scripts/migrate.mjs.
// Never throws: read at render time (Settings), where a failure must not break the page.
export async function hasLoggedEvent(eventType: ProductEventType): Promise<boolean> {
  try {
    const { sql } = await getAuthedContext();
    const [row] = (await sql`SELECT has_logged_event(${eventType}) AS logged`) as { logged: boolean }[];
    return row?.logged ?? false;
  } catch (error) {
    console.error(`has_logged_event("${eventType}") failed`, error);
    return false;
  }
}
