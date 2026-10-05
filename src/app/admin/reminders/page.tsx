import Link from "next/link";
import { requireAdminPage, getAdminRecentReminderLogs } from "@/lib/admin";
import { ReminderLogPreviewRow } from "@/components/ReminderLogPreviewRow";

export const dynamic = "force-dynamic";

// "l'admin peut prévisualiser chaque e-mail dans /admin, sans l'envoyer" — restricted
// to the admin's own account and disposable test accounts, never real users', by
// admin_list_recent_reminder_logs() itself (scripts/migrate.mjs), independently of
// whether sending is enabled.
export default async function AdminRemindersPage() {
  await requireAdminPage();
  const logs = await getAdminRecentReminderLogs();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <Link href="/admin" className="text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400">
            ← Administration
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Aperçu des rappels par e-mail
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Comptes admin et comptes de test uniquement — jamais le contenu d&apos;un compte réel.
          </p>
        </header>
        <ul className="flex flex-col gap-3">
          {logs.map((log) => (
            <ReminderLogPreviewRow key={log.id} log={log} />
          ))}
          {logs.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun aperçu pour l&apos;instant.</p>}
        </ul>
      </main>
    </div>
  );
}
