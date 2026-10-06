import { requireAdminPage, getAdminRecentReminderLogs } from "@/lib/admin";
import { ReminderLogPreviewRow } from "@/components/ReminderLogPreviewRow";
import { BackLink } from "@/components/ui";

export const dynamic = "force-dynamic";

// "l'admin peut prévisualiser chaque e-mail dans /admin, sans l'envoyer" — restricted
// to the admin's own account and disposable test accounts, never real users', by
// admin_list_recent_reminder_logs() itself (scripts/migrate.mjs), independently of
// whether sending is enabled.
export default async function AdminRemindersPage() {
  await requireAdminPage();
  const logs = await getAdminRecentReminderLogs();

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 pt-5 pb-10 sm:pt-8">
        <header>
          <BackLink href="/admin">Administration</BackLink>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink">
            Aperçu des rappels par e-mail
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Comptes admin et comptes de test uniquement, jamais le contenu d&apos;un compte réel.
          </p>
        </header>
        <ul className="flex flex-col gap-3">
          {logs.map((log) => (
            <ReminderLogPreviewRow key={log.id} log={log} />
          ))}
          {logs.length === 0 && <p className="text-sm text-ink-2">Aucun aperçu pour l&apos;instant.</p>}
        </ul>
      </main>
    </div>
  );
}
