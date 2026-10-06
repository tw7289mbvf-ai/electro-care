import Link from "next/link";
import {
  requireAdminPage,
  getAdminOverview,
  getAdminObligationCounts,
  getAdminActionLog,
  getAdminRequests,
  getAdminComplianceByAccount,
} from "@/lib/admin";
import { getKpiIndicators, getMultiHomeBreakdown } from "@/lib/admin-metrics";
import { AdminAccountRow } from "@/components/AdminAccountRow";
import { AdminRequestRow } from "@/components/AdminRequestRow";
import { BackLink, SegmentedBar } from "@/components/ui";

// Same rule as every other page reading live data (see src/app/page.tsx): never served
// from a static/ISR cache.
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  suspend: "Suspension",
  reactivate: "Réactivation",
  delete: "Suppression",
  send_reset_link: "Lien de réinitialisation envoyé",
  view_compliance: "Consultation de la conformité par compte",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(
    new Date(iso)
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" }).format(new Date(iso));
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] bg-surface p-4">
      <p className="text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink-2">{label}</p>
    </div>
  );
}

export default async function AdminPage() {
  const adminAccountId = await requireAdminPage();
  const { stats, accounts } = await getAdminOverview();
  // Before the action log: this viewing's own journal entry then shows up in it.
  const compliance = await getAdminComplianceByAccount(accounts);
  const [obligationCounts, actionLog, requests, kpiIndicators, multiHomeBreakdown] = await Promise.all([
    getAdminObligationCounts(),
    getAdminActionLog(accounts),
    getAdminRequests(),
    getKpiIndicators(),
    getMultiHomeBreakdown(),
  ]);

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 pt-5 pb-10 sm:pt-8">
        <header>
          <BackLink href="/">Tableau de bord</BackLink>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink">
            Administration
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Vue globale, sans accès au contenu des comptes.
          </p>
          <Link href="/admin/reminders" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">
            Aperçu des rappels par e-mail →
          </Link>
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
          <h2 className="text-lg font-semibold text-ink">Mesure du MVP</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {kpiIndicators.map((indicator) => (
              <div key={indicator.key} className="rounded-[20px] bg-surface p-4">
                <p className="text-xl font-semibold text-ink">
                  {indicator.ratio === null ? "—" : `${Math.round(indicator.ratio * 100)} %`}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">{indicator.label}</p>
                <p className="mt-1 text-[13px] text-ink-2">{indicator.detail}</p>
              </div>
            ))}
            <div className="rounded-2xl border-[1.5px] border-dashed border-line-strong p-4">
              <p className="text-xl font-semibold text-ink-2">—</p>
              <p className="mt-1 text-sm font-medium text-ink">Modèle économique</p>
              <p className="mt-1 text-[13px] text-ink-2">Suivi manuel (prestataires prêts à payer).</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Multi-logements</h2>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-surface-2 text-left text-ink-2">
                <tr>
                  <th className="px-4 py-2 font-medium">Logements</th>
                  <th className="px-4 py-2 font-medium">Comptes</th>
                  <th className="px-4 py-2 font-medium">Engagement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {multiHomeBreakdown.map((bucket) => (
                  <tr key={bucket.label}>
                    <td className="px-4 py-2 text-ink">{bucket.label}</td>
                    <td className="px-4 py-2 text-ink-2">{bucket.accounts}</td>
                    <td className="px-4 py-2 text-ink-2">
                      {bucket.accounts === 0 ? "—" : `${Math.round((bucket.engagedAccounts / bucket.accounts) * 100)} %`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Comptes</h2>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface-2 text-left text-ink-2">
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
              <tbody className="divide-y divide-line bg-surface">
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
                    <td colSpan={7} className="px-4 py-6 text-center text-ink-2">
                      Aucun compte.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Conformité par compte</h2>
          <p className="text-sm text-ink-2">
            Décomptes uniquement, pour le support. Chaque consultation est enregistrée dans le journal.
          </p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface-2 text-left text-ink-2">
                <tr>
                  <th className="px-4 py-2 font-medium">E-mail</th>
                  <th className="px-4 py-2 font-medium">Inscrit le</th>
                  <th className="px-4 py-2 font-medium">Lieux</th>
                  <th className="px-4 py-2 font-medium">En retard</th>
                  <th className="px-4 py-2 font-medium">À confirmer</th>
                  <th className="px-4 py-2 font-medium">À jour</th>
                  <th className="w-32 px-4 py-2 font-medium">Jauge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {compliance.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 text-ink">{row.email}</td>
                    <td className="px-4 py-2 text-ink-2">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-2 text-ink-2">{row.placesCount}</td>
                    <td className="px-4 py-2 text-ink-2">{row.counts.overdue}</td>
                    <td className="px-4 py-2 text-ink-2">{row.counts.toConfirm}</td>
                    <td className="px-4 py-2 text-ink-2">{row.counts.upToDate}</td>
                    <td className="px-4 py-2">
                      <SegmentedBar counts={row.counts} thin />
                    </td>
                  </tr>
                ))}
                {compliance.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-ink-2">
                      Aucun compte.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Demandes</h2>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface-2 text-left text-ink-2">
                <tr>
                  <th className="px-4 py-2 font-medium">Reçu le</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">E-mail</th>
                  <th className="px-4 py-2 font-medium">Message</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {requests.map((request) => (
                  <AdminRequestRow key={request.id} request={request} formattedCreatedAt={formatDateTime(request.createdAt)} />
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-ink-2">
                      Aucune demande pour l&apos;instant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">Journal des actions</h2>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-surface-2 text-left text-ink-2">
                <tr>
                  <th className="px-4 py-2 font-medium">Quand</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Compte visé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {actionLog.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 text-ink-2">{formatDateTime(entry.createdAt)}</td>
                    <td className="px-4 py-2 text-ink">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </td>
                    <td className="px-4 py-2 text-ink-2">
                      {entry.targetAccountId === null ? "—" : entry.targetEmail ?? "compte supprimé"}
                    </td>
                  </tr>
                ))}
                {actionLog.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-ink-2">
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
