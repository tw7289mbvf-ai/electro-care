import Link from "next/link";

export default function ConditionsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/settings" className="text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400">
          ← Retour aux paramètres
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Conditions d&apos;utilisation
        </h1>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Objet du service</h2>
          <p>
            Electro Care aide à suivre l&apos;entretien des appareils électroménagers d&apos;un logement et les
            obligations légales associées. Les rappels et informations affichés sont donnés à titre indicatif et ne
            remplacent pas l&apos;avis d&apos;un professionnel.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Compte utilisateur</h2>
          <p>
            L&apos;accès au service nécessite un compte. Vous êtes responsable de la confidentialité de vos
            identifiants et de l&apos;exactitude des informations que vous renseignez.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Éditeur</h2>
          <p>[À COMPLÉTER : identité de l&apos;éditeur, voir les mentions légales]</p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Contact</h2>
          <p>[À COMPLÉTER : adresse e-mail de contact]</p>
        </section>
      </main>
    </div>
  );
}
