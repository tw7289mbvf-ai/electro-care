import { BackLink } from "@/components/ui";

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pt-5 pb-10 sm:pt-8">
        <div className="flex flex-wrap gap-3">
          <BackLink href="/">Tableau de bord</BackLink>
          <BackLink href="/settings">Retour aux paramètres</BackLink>
        </div>
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink">Mentions légales</h1>
          <p className="mt-1 text-sm text-ink-2">Dernière mise à jour : 28 septembre 2026</p>
        </div>

        <section className="flex flex-col gap-2 text-[15px] leading-relaxed text-ink">
          <h2 className="font-display text-[19px] font-semibold text-ink">Éditeur</h2>
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

        <section className="flex flex-col gap-2 text-[15px] leading-relaxed text-ink">
          <h2 className="font-display text-[19px] font-semibold text-ink">Directeur de la publication</h2>
          <p>Mathieu Decrop.</p>
        </section>

        <section className="flex flex-col gap-2 text-[15px] leading-relaxed text-ink">
          <h2 className="font-display text-[19px] font-semibold text-ink">Hébergement</h2>
          <p>
            Le service est hébergé par Vercel Inc., 440 North Barranca Avenue, Suite 4133, Covina, Californie 91723,
            États-Unis. Téléphone : +1 951-383-6898. Site : vercel.com.
          </p>
          <p>
            Les données des comptes sont stockées dans une base de données hébergée dans l&apos;Union européenne, à
            Francfort, par Neon, Inc. La politique de confidentialité détaille l&apos;ensemble des prestataires.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-[15px] leading-relaxed text-ink">
          <h2 className="font-display text-[19px] font-semibold text-ink">Propriété intellectuelle</h2>
          <p>
            L&apos;interface d&apos;Electro Care, ses textes et son référentiel des obligations et de l&apos;entretien
            sont la propriété de l&apos;éditeur. Toute reproduction sans autorisation est interdite. Les informations
            et documents que vous déposez restent les vôtres.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-[15px] leading-relaxed text-ink">
          <h2 className="font-display text-[19px] font-semibold text-ink">Contact</h2>
          <p>
            Pour toute question : matdec41@hotmail.com, ou le formulaire « Contacter l&apos;administrateur » dans
            Paramètres.
          </p>
        </section>
      </main>
    </div>
  );
}
