import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth/server";

// Every query runs as the Postgres `authenticated` role with the caller's own JWT
// attached, never as `neondb_owner` (which owns the tables and bypasses row-level
// security). Row-level security is what actually stops one account from reading or
// writing another's rows — this is not a convenience wrapper, it is the isolation.
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
