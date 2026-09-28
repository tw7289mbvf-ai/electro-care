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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Mentions légales</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Dernière mise à jour : 28 septembre 2026</p>
        </div>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Éditeur</h2>
          <p>
            Le service Electro Care, accessible à l&apos;adresse electro-care-seven.vercel.app, est édité par :
          </p>
          <ul className="list-disc pl-5">
            <li>Mathieu Decrop, personne physique</li>
            <li>Adresse : 43 rue Rosa Bonheur, 33000 Bordeaux</li>
            <li>Téléphone : 06 60 38 51 96</li>
            <li>E-mail : matdec41@hotmail.com</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Directeur de la publication</h2>
          <p>Mathieu Decrop.</p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Hébergement</h2>
          <p>
            Le service est hébergé par Vercel Inc., 440 North Barranca Avenue, Suite 4133, Covina, Californie 91723,
            États-Unis. Téléphone : +1 951-383-6898. Site : vercel.com.
          </p>
          <p>
            Les données des comptes sont stockées dans une base de données hébergée dans l&apos;Union européenne, à
            Francfort, par Neon, Inc. La politique de confidentialité détaille l&apos;ensemble des prestataires.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Propriété intellectuelle</h2>
          <p>
            L&apos;interface d&apos;Electro Care, ses textes et son référentiel des obligations et de l&apos;entretien
            sont la propriété de l&apos;éditeur. Toute reproduction sans autorisation est interdite. Les informations
            et documents que vous déposez restent les vôtres.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Contact</h2>
          <p>
            Pour toute question : matdec41@hotmail.com, ou le formulaire « Contacter l&apos;administrateur » dans
            Paramètres.
          </p>
        </section>
      </main>
    </div>
  );
}
