import { getCronContext } from "@/lib/cron-auth";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public, capability-token route — the link at the bottom of every reminder email
// (spec's "Opt-out"). The visitor's own session (if any) is never checked, only the
// unguessable token; see src/lib/cron-auth.ts for why this connects as the `cron`
// account rather than a genuinely anonymous one.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (UUID_PATTERN.test(token)) {
    const { sql } = await getCronContext();
    await sql`SELECT unsubscribe_by_token(${token})`;
  }
  return new Response(
    `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Rappels désactivés</title></head>` +
      `<body style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#18181b;">` +
      `<p>Les rappels par e-mail sont désactivés. Vous pouvez les réactiver à tout moment dans Paramètres.</p>` +
      `</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
