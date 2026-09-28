import Link from "next/link";

export default function ConditionsPage() {
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Conditions d&apos;utilisation
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Dernière mise à jour : 28 septembre 2026</p>
        </div>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">1. Objet</h2>
          <p>
            Electro Care aide les particuliers à suivre les obligations légales d&apos;entretien de leur logement et
            de leurs équipements (chaudière, ramonage, détecteur de fumée…) ainsi que leur entretien courant. Les
            présentes conditions encadrent l&apos;utilisation du service. En créant un compte, vous les acceptez.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">2. Accès et prix</h2>
          <p>
            Le service est gratuit pour les particuliers. Il est actuellement en phase de test : ses fonctionnalités
            peuvent évoluer, et il peut être momentanément interrompu, notamment pour maintenance.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">3. Votre compte</h2>
          <p>
            Vous créez votre compte avec une adresse e-mail valide et un mot de passe, que vous gardez confidentiel.
            Vous êtes responsable de l&apos;exactitude des informations que vous saisissez.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">4. Nature des informations fournies</h2>
          <p>
            Les informations sur les obligations légales, leurs échéances et leurs risques sont établies avec soin à
            partir des textes en vigueur et de sources publiques. Elles sont fournies à titre d&apos;aide : elles ne
            constituent pas un conseil juridique et ne remplacent ni les textes officiels ni l&apos;avis d&apos;un
            professionnel qualifié. Les échéances sont calculées à partir des informations que vous saisissez, et
            vous restez responsable du respect de vos obligations.
          </p>
          <p>
            Les procédures d&apos;entretien décrivent des gestes courants. Toute intervention sur une installation
            de gaz, un appareil à combustion ou une installation électrique, au-delà des gestes décrits, doit être
            confiée à un professionnel.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">5. Responsabilité</h2>
          <p>
            L&apos;éditeur met en œuvre des moyens raisonnables pour assurer l&apos;exactitude des informations et
            la disponibilité du service. Dans les limites prévues par la loi, sa responsabilité ne peut être engagée
            en cas d&apos;erreur ou d&apos;omission dans une information fournie à titre d&apos;aide, d&apos;erreur
            de saisie de votre part ou d&apos;interruption du service.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">6. Données personnelles</h2>
          <p>L&apos;utilisation de vos données est décrite dans la politique de confidentialité.</p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">7. Propriété intellectuelle</h2>
          <p>
            Le service, son interface et son référentiel appartiennent à l&apos;éditeur. Vous conservez la propriété
            des informations et documents que vous y déposez.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">8. Fin de l&apos;utilisation</h2>
          <p>
            Vous pouvez demander la suppression de votre compte à tout moment depuis Paramètres : elle intervient
            sous 7 jours. L&apos;éditeur peut suspendre un compte en cas d&apos;usage abusif ou contraire aux
            présentes conditions.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">9. Modification des conditions</h2>
          <p>
            Ces conditions peuvent évoluer avec le service. En cas de changement important, vous en serez informé
            dans l&apos;application.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">10. Droit applicable et litiges</h2>
          <p>
            Les présentes conditions sont soumises au droit français. En cas de difficulté, contactez-nous d&apos;abord
            via le formulaire « Contacter l&apos;administrateur » ou par e-mail, afin de rechercher une solution
            amiable. À défaut, le litige relève des tribunaux compétents selon les règles de droit commun.
          </p>
        </section>
      </main>
    </div>
  );
}
