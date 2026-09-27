import { getAuthedContext } from "@/lib/db";

// "Dernière connexion" / "actifs sur 30 jours" (admin dashboard) have no equivalent in
// Neon Auth, which doesn't track last sign-in. Throttled to ~once/day per account via
// the WHERE clause on the upsert, so this never adds a write to every page load.
export async function touchAccountActivity(): Promise<void> {
  const { sql, accountId } = await getAuthedContext();
  await sql`
    INSERT INTO account_activity (account_id, last_seen_at)
    VALUES (${accountId}, now())
    ON CONFLICT (account_id) DO UPDATE
      SET last_seen_at = EXCLUDED.last_seen_at
      WHERE account_activity.last_seen_at < now() - interval '1 day'
  `;
}
