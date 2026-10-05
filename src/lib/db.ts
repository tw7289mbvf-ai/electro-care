import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

// Every query runs as the Postgres `authenticated` role with the caller's own JWT
// attached, never as `neondb_owner` (which owns the tables and bypasses row-level
// security). Row-level security is what actually stops one account from reading or
// writing another's rows — this is not a convenience wrapper, it is the isolation.
//
// Checked once at module load, not per query: if DATABASE_URL is ever repointed at
// neondb_owner (e.g. a botched cutover reusing the admin connection string), every
// account would see every other account's data with no error to notice. Failing the
// whole module at import time, loudly, is safer than a query that silently succeeds.
const connectionRole = new URL(process.env.DATABASE_URL!).username;
if (connectionRole === "neondb_owner") {
  throw new Error(
    "DATABASE_URL points at neondb_owner, which bypasses row-level security. " +
      "The app must connect as the `authenticated` role — see CLAUDE.md, " +
      "\"Production database operations\"."
  );
}

// For src/lib/cron-auth.ts: the cron job's connection still goes through this one
// centralized place that calls the raw neon() constructor, same as every other
// connection in the app — scripts/test-isolation.mjs greps for exactly that invariant.
export function getSqlForToken(token: string) {
  return neon(process.env.DATABASE_URL!, { authToken: token });
}

export async function getAuthedContext() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  const { data: tokenData } = await auth.token();
  if (!tokenData?.token) {
    throw new Error("Not authenticated");
  }
  const sql = neon(process.env.DATABASE_URL!, { authToken: tokenData.token });
  return { sql, accountId: session.user.id };
}
