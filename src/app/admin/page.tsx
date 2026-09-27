import { requireAdminPage, getAdminOverview, getAdminObligationCounts, getAdminActionLog } from "@/lib/admin";
import { AdminAccountRow } from "@/components/AdminAccountRow";

// Same rule as every other page reading live data (see src/app/page.tsx): never served
// from a static/ISR cache.
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  suspend: "Suspension",
  reactivate: "Réactivation",
  delete: "Suppression",
  send_reset_link: "Lien de réinitialisation envoyé",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(
    new Date(iso)
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

export default async function AdminPage() {
  const adminAccountId = await requireAdminPage();
  const { stats, accounts } = await getAdminOverview();
  const [obligationCounts, actionLog] = await Promise.all([
    getAdminObligationCounts(),
    getAdminActionLog(accounts),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Administration
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Vue globale, sans accès au contenu des comptes.
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Comptes" value={stats.accountsTotal} />
          <StatTile label="Nouveaux (7 jours)" value={stats.accountsNew7d} />
          <StatTile label="Actifs (30 jours)" value={stats.accountsActive30d} />
          <StatTile label="Lieux" value={stats.placesTotal} />
          <StatTile label="Appareils" value={stats.appliancesTotal} />
          <StatTile label="Questionnaires terminés" value={stats.questionnairesCompleted} />
          <StatTile label="Obligations en retard" value={obligationCounts.overdue} />
          <StatTile label="Obligations à confirmer" value={obligationCounts.toConfirm} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Comptes</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-zinc-100 text-left text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">E-mail</th>
                  <th className="px-4 py-2 font-medium">Créé le</th>
                  <th className="px-4 py-2 font-medium">Dernière connexion</th>
                  <th className="px-4 py-2 font-medium">Lieux</th>
                  <th className="px-4 py-2 font-medium">Appareils</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {accounts.map((account) => (
                  <AdminAccountRow
                    key={account.id}
                    account={account}
                    isSelf={account.id === adminAccountId}
                    formattedCreatedAt={formatDateTime(account.createdAt)}
                    formattedLastSeenAt={account.lastSeenAt ? formatDateTime(account.lastSeenAt) : "—"}
                  />
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                      Aucun compte.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Journal des actions</h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-zinc-100 text-left text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Quand</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Compte visé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {actionLog.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{formatDateTime(entry.createdAt)}</td>
                    <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                      {entry.targetEmail ?? "compte supprimé"}
                    </td>
                  </tr>
                ))}
                {actionLog.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                      Aucune action pour l&apos;instant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
