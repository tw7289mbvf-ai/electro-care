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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Politique de confidentialité
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Dernière mise à jour : 28 septembre 2026</p>
        </div>

        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Electro Care vous aide à suivre les obligations d&apos;entretien de votre logement. Cette page explique
          quelles données nous utilisons, pourquoi, et comment exercer vos droits.
        </p>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Qui est responsable de vos données ?</h2>
          <p>
            Mathieu Decrop, éditeur d&apos;Electro Care, 43 rue Rosa Bonheur, 33000 Bordeaux. Contact :
            matdec41@hotmail.com.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Quelles données, et pourquoi ?</h2>
          <ul className="list-disc pl-5">
            <li>
              <strong>Votre compte</strong> : adresse e-mail et mot de passe. Le mot de passe n&apos;est conservé que
              sous forme d&apos;empreinte chiffrée : personne ne peut le lire, pas même nous. Ces données servent à
              créer et sécuriser votre compte.
            </li>
            <li>
              <strong>Vos lieux</strong> : nom, adresse postale (facultative), code postal, commune, type de logement
              et niveau d&apos;entretien choisi. La commune et le type de logement déterminent vos obligations ;
              l&apos;adresse sert à préremplir vos demandes d&apos;intervention.
            </li>
            <li>
              <strong>Vos appareils et leur suivi</strong> : type d&apos;appareil, marque et modèle s&apos;ils sont
              renseignés, dates d&apos;entretien, réponses au questionnaire. Ils servent à calculer vos échéances et
              votre entretien.
            </li>
            <li>
              <strong>Votre activité</strong> : la date de votre dernière connexion, enregistrée au plus une fois par
              jour, pour mesurer l&apos;usage du service.
            </li>
            <li>
              <strong>Vos demandes</strong> : les messages envoyés avec « Contacter l&apos;administrateur » et les
              demandes de suppression de compte, pour y répondre.
            </li>
          </ul>
          <p>Nous ne collectons aucune donnée de paiement.</p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Sur quelle base ?</h2>
          <ul className="list-disc pl-5">
            <li>
              <strong>L&apos;exécution du service</strong> que vous avez choisi d&apos;utiliser (article 6.1.b du
              RGPD), pour votre compte, vos lieux et vos appareils.
            </li>
            <li>
              <strong>Notre intérêt légitime</strong> (article 6.1.f du RGPD), pour la sécurité du service, la
              mesure de son usage et le traitement de vos messages.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Qui y a accès ?</h2>
          <ul className="list-disc pl-5">
            <li>
              <strong>Vous seul voyez vos lieux et vos appareils</strong> : chaque compte est cloisonné
              techniquement, au niveau de la base de données.
            </li>
            <li>
              <strong>L&apos;administrateur</strong> voit la liste des comptes : e-mail, dates de création et de
              dernière connexion, nombre de lieux et d&apos;appareils. Jamais le contenu de vos lieux, ni vos
              adresses.
            </li>
            <li>
              <strong>Nos prestataires techniques</strong>, qui traitent les données pour notre compte :
              <ul className="list-disc pl-5">
                <li>
                  Vercel Inc. (États-Unis) : hébergement et exécution de l&apos;application, sur des serveurs situés
                  dans l&apos;Union européenne, à Francfort.
                </li>
                <li>
                  Neon, Inc. (États-Unis) : base de données hébergée dans l&apos;Union européenne, à Francfort, sur
                  l&apos;infrastructure d&apos;Amazon Web Services ; Neon fournit aussi le service de connexion.
                </li>
              </ul>
            </li>
          </ul>
          <p>
            Ces deux sociétés étant américaines, un accès depuis les États-Unis ne peut être exclu, par exemple pour
            le support technique. Ces transferts éventuels sont encadrés par les garanties prévues par le RGPD,
            notamment les clauses contractuelles types adoptées par la Commission européenne.
          </p>
          <p>Nous ne vendons ni ne louons vos données, et Electro Care n&apos;affiche aucune publicité.</p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Combien de temps ?</h2>
          <ul className="list-disc pl-5">
            <li>
              <strong>Compte, lieux et appareils</strong> : tant que votre compte est actif. Après une demande de
              suppression, tout est effacé sous 7 jours.
            </li>
            <li>
              <strong>Copies de sauvegarde techniques</strong> : supprimées après usage, au plus tard 30 jours après
              leur création.
            </li>
            <li>
              <strong>Messages et demandes</strong> : 12 mois après leur traitement.
            </li>
            <li>
              <strong>Journal des actions d&apos;administration</strong> : 12 mois. Il ne contient que des
              identifiants de compte, jamais d&apos;adresse e-mail.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Cookies</h2>
          <p>
            Electro Care n&apos;utilise que le cookie strictement nécessaire à votre connexion. Aucun cookie
            publicitaire ni de mesure d&apos;audience : aucun consentement n&apos;est donc demandé.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Vos droits</h2>
          <p>
            Vous pouvez accéder à vos données, les rectifier, les effacer, en limiter l&apos;utilisation, vous y
            opposer ou les récupérer. Pour cela, utilisez Paramètres (« Demander la suppression de mon compte »,
            « Contacter l&apos;administrateur ») ou écrivez à matdec41@hotmail.com. Nous répondons sous un mois au
            plus.
          </p>
          <p>
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL
            (www.cnil.fr).
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Modifications</h2>
          <p>
            Cette politique peut évoluer avec le service. En cas de changement important, vous en serez informé dans
            l&apos;application.
          </p>
        </section>
      </main>
    </div>
  );
}
