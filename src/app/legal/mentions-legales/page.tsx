import Link from "next/link";

export default function MentionsLegalesPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Mentions légales</h1>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Éditeur du site</h2>
          <p>[À COMPLÉTER : nom ou raison sociale, statut juridique, adresse, numéro SIRET, directeur de la publication]</p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Hébergement</h2>
          <p>[À COMPLÉTER : nom et adresse de l&apos;hébergeur des applications (Vercel) et de la base de données (Neon)]</p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Contact</h2>
          <p>[À COMPLÉTER : adresse e-mail ou formulaire de contact]</p>
        </section>
      </main>
    </div>
  );
}
