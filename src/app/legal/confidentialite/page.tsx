import Link from "next/link";

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400">
            ← Tableau de bord
          </Link>
          <Link href="/settings" className="text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400">
            ← Retour aux paramètres
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Politique de confidentialité
        </h1>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Responsable du traitement</h2>
          <p>[À COMPLÉTER : identité et coordonnées du responsable du traitement]</p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Données collectées</h2>
          <p>
            Adresse e-mail (compte), lieux (nom, commune, code postal, type de bien), appareils que vous renseignez
            (marque, modèle, numéro de série, dates), et les factures ou notices que vous ajoutez. Chaque compte ne
            voit que ses propres données.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Hébergement et localisation</h2>
          <p>Les données sont hébergées dans l&apos;Union européenne.</p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Vos droits</h2>
          <p>
            Vous pouvez supprimer votre compte et l&apos;ensemble de vos données à tout moment depuis les paramètres,
            sans intervention de notre part. Pour toute autre demande (accès, rectification), contactez-nous :
            [À COMPLÉTER : adresse e-mail de contact pour les demandes RGPD].
          </p>
        </section>
      </main>
    </div>
  );
}
