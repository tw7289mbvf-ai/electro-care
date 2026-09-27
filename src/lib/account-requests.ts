import { getAuthedContext } from "@/lib/db";

// Deletion requests and contact messages: one table (account_requests), since the
// admin page lists them together (spec's "Requests" section). RLS scopes every row to
// its own account (scripts/migrate.mjs); only SELECT/INSERT are granted to
// `authenticated`, so handled_at can only ever be set by the admin's own
// SECURITY DEFINER function.

export async function createDeletionRequest(email: string): Promise<void> {
  const { sql, accountId } = await getAuthedContext();
  await sql`
    INSERT INTO account_requests (account_id, kind, email)
    VALUES (${accountId}, 'deletion', ${email})
  `;
}

export async function createContactMessage(email: string, message: string): Promise<void> {
  const { sql, accountId } = await getAuthedContext();
  await sql`
    INSERT INTO account_requests (account_id, kind, email, message)
    VALUES (${accountId}, 'contact', ${email}, ${message})
  `;
}

// So Paramètres can show "already requested" instead of a button that would just
// create a duplicate row every time it's clicked.
export async function hasPendingDeletionRequest(): Promise<boolean> {
  const { sql, accountId } = await getAuthedContext();
  const rows = await sql`
    SELECT 1 FROM account_requests
    WHERE account_id = ${accountId} AND kind = 'deletion' AND handled_at IS NULL
    LIMIT 1
  `;
  return rows.length > 0;
}
