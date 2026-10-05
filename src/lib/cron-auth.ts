import { getSqlForToken } from "@/lib/db";

// Authenticates the daily reminder job (and, unusually, two public routes — see below)
// the same way scripts/test-isolation.mjs gets a token for a throwaway account: a
// plain fetch to Neon Auth's own HTTP API, never through Next's cookie-based
// auth.getSession() (that would entangle this request with whatever cookies happen to
// be on it, which for the cron route have nothing to do with any real visitor, and
// for a public link route must never accidentally pick up a *different* signed-in
// visitor's own session). The resulting JWT is used exactly like any other signed-in
// session: still the `authenticated` Postgres role, RLS intact, scoped to whatever the
// `cron`-role account is allowed to see (the narrow SECURITY DEFINER functions in
// scripts/migrate.mjs) — this never touches the table-owning, RLS-bypassing role.
//
// Also used by src/app/go/[logId] and src/app/api/unsubscribe/[token]: both are meant
// to work with no session (a signed-out click from an email), and this Neon Auth
// instance's `anonymous` Postgres role turned out to need real credentials this app
// doesn't have for a genuinely sessionless connection (found during this chantier's
// rollout — connecting as `anonymous@<host>` with no authToken fails with "missing
// authentication credentials"). Those two routes authenticate as the `cron` account
// the same way, and the SQL functions they call gate on `_require_cron()` instead of
// a public GRANT — the capability is still the unguessable id/token in the URL, not
// this account; `cron` here just means "a trusted server-side caller", not a person.
export async function getCronContext() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL!;
  const email = process.env.CRON_ACCOUNT_EMAIL!;
  const password = process.env.CRON_ACCOUNT_PASSWORD!;

  const signIn = await fetch(`${baseUrl}/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: process.env.APP_URL ?? "http://localhost:3000" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = signIn.headers.get("set-cookie");
  if (!signIn.ok || !cookie) {
    throw new Error("cron: sign-in failed");
  }
  const tokenRes = await fetch(`${baseUrl}/token`, { headers: { Cookie: cookie } });
  const { token } = (await tokenRes.json()) as { token?: string };
  if (!token) {
    throw new Error("cron: token fetch failed");
  }
  const sql = getSqlForToken(token);
  return { sql };
}
