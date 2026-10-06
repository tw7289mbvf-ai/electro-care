import Link from "next/link";
import { PlaceCard } from "@/components/PlaceCard";
import { UrgentActions } from "@/components/UrgentActions";
import { DemoDashboard } from "@/components/DemoDashboard";
import { SignOutButton } from "@/components/SignOutButton";
import { getAppliances } from "@/lib/appliances";
import { getPlaces } from "@/lib/places";
import { comparePlacesByPropertyType } from "@/lib/place-types";
import { getObligationRecordsForPlace } from "@/lib/appliance-obligations";
import { getAppointmentsForPlace } from "@/lib/obligation-appointments";
import { getObligationCountsForAppliances, type ObligationCounts } from "@/lib/obligations";
import { getMaintenanceCompletionsForPlace } from "@/lib/maintenance-completions";
import { getMaintenanceDeferralsForPlace } from "@/lib/maintenance-deferrals";
import { getMaintenanceGuidanceForAppliances, filterPendingGuidance, applyDeferrals } from "@/lib/maintenance-guidance";
import { currentMonthKey } from "@/lib/french-dates";
import { touchAccountActivity } from "@/lib/account-activity";
import { getInvoiceImportMode } from "@/lib/invoice-extraction";
import { requireAdminRoute } from "@/lib/admin";
import { auth } from "@/lib/auth/server";
import { logProductEvent } from "@/lib/product-events";
import { getAccountPreferencesOrNull, shouldShowSatisfactionSurvey, markSatisfactionSurveyShown } from "@/lib/account-preferences";
import { SatisfactionSurveyModal } from "@/components/SatisfactionSurveyModal";
import {
  AddLink,
  BUTTON_PRIMARY,
  BUTTON_SURFACE,
  LINK_ACTION,
  ComplianceGauge,
  Icon,
  PAGE_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_TITLE_CLASS,
  Section,
} from "@/components/ui";

// Every page here reads user data straight from Postgres: it must never be served
// from a static/ISR cache, or edits made outside the app (migrations, other users)
// would stay invisible until the next build.
export const dynamic = "force-dynamic";

const INTRO_SOURCES = [
  { name: "Santé publique France", href: "https://www.santepubliquefrance.fr/monoxyde-de-carbone/les-enjeux-de-sante" },
  { name: "ARS Centre-Val de Loire", href: "https://www.centre-val-de-loire.ars.sante.fr/media/146417/download" },
  { name: "Ademe", href: "https://librairie.ademe.fr/ged/651/infographie-electromenager-faire-durer-pannes.pdf" },
  {
    name: "Gifam",
    href: "https://leclaireur.fnac.com/article/469243-et-si-le-menage-de-printemps-pouvait-contribuer-aux-economies-denergie/",
  },
  { name: "Groupama", href: "https://www.groupama.fr/assurance-habitation/conseils/ramonage-indispensable-et-obligatoire/" },
];

function IntroStat({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-[40px] font-bold leading-none tracking-[-0.5px] text-ink">{value}</span>
      <p className="text-[15px] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

export default async function Home() {
  // A signed-out visitor never triggers a database read on this page: the check below
  // is the only thing standing between "/" and a live query, so it must come first,
  // and the demo branch below must stay free of any call into src/lib/*.
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return (
      <main className={PAGE_CLASS}>
        <header className="flex flex-col gap-1">
          <h1 className={PAGE_TITLE_CLASS}>Electro Care</h1>
          <p className="text-[15px] text-ink-2">Suivez les appareils de votre maison, connectez-vous pour commencer.</p>
        </header>

        <section className="flex flex-wrap gap-2.5">
          <Link href="/auth/sign-in" className={BUTTON_PRIMARY}>
            Se connecter
          </Link>
          <Link href="/auth/sign-up" className={BUTTON_SURFACE}>
            Créer un compte
          </Link>
        </section>

        <section className="flex flex-col gap-5 rounded-3xl bg-surface p-5">
          <div className="flex flex-col gap-2">
            <h2 className={SECTION_TITLE_CLASS}>Votre logement est-il en règle ?</h2>
            <p className="text-[15px] leading-relaxed text-ink-2">
              Chaudière, ramonage, détecteur de fumée, climatisation, fosse septique : selon ses
              équipements, un logement est soumis à plusieurs obligations d&apos;entretien, chacune à son
              rythme, tous les ans, tous les deux ans, tous les dix ans. Difficile de tout retenir. Et
              les oublis ont un prix :
            </p>
          </div>
          <IntroStat value="450 €">l&apos;amende encourue pour un ramonage oublié.</IntroStat>
          <IntroStat value="Près de 4 000">
            intoxications au monoxyde de carbone chaque année en France, dont une centaine mortelles.
            La chaudière est en cause dans plus de la moitié des cas à domicile.
          </IntroStat>
          <p className="text-[15px] leading-relaxed text-ink-2">
            Et en cas de sinistre, un entretien que vous ne pouvez pas prouver peut réduire
            l&apos;indemnisation de votre assureur.
          </p>

          <div className="flex flex-col gap-2">
            <h2 className={SECTION_TITLE_CLASS}>Et vos appareils du quotidien ?</h2>
            <p className="text-[15px] leading-relaxed text-ink-2">
              Rien d&apos;obligatoire ici, mais un vrai enjeu : un foyer compte en moyenne plus de sept
              gros appareils électroménagers, et quelques gestes simples font toute la différence.
            </p>
          </div>
          <IntroStat value="6 sur 10">
            appareils de gros électroménager rapportés au service après-vente souffrent simplement
            d&apos;un défaut d&apos;entretien, sans aucune pièce à changer.
          </IntroStat>
          <IntroStat value="Jusqu'à 30 %">
            d&apos;électricité en plus pour un réfrigérateur à la grille encrassée, ou un congélateur
            couvert de givre.
          </IntroStat>

          <div className="flex flex-col gap-2">
            <h2 className={SECTION_TITLE_CLASS}>Pas d&apos;inquiétude : Electro Care s&apos;en occupe.</h2>
            <p className="text-[15px] leading-relaxed text-ink-2">
              En quelques questions, l&apos;app établit la liste de vos obligations, vous prévient avant
              chaque échéance et garde la trace de chaque intervention. Et chaque mois, elle vous
              indique les bons gestes, appareil par appareil, avec le temps qu&apos;ils prennent.
            </p>
          </div>
          <Link href="/auth/sign-up" className={`${BUTTON_PRIMARY} self-start`}>
            Faire le point sur mon logement
          </Link>
        </section>

        <DemoDashboard />

        <p className="text-[13px] text-ink-2">
          Sources :{" "}
          {INTRO_SOURCES.map(({ name, href }, i) => (
            <span key={href}>
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
                {name}
              </a>
              {i < INTRO_SOURCES.length - 1 ? ", " : ". "}
            </span>
          ))}
          Chiffres vérifiés en octobre 2026.
        </p>
      </main>
    );
  }

  await touchAccountActivity();
  // Idempotent (unique per account) — re-run every visit, harmless after the first,
  // and logged server-side rather than reacting to the sign-up form's result.
  await logProductEvent("account_created");
  const preferences = await getAccountPreferencesOrNull();
  const showSatisfactionSurvey =
    preferences !== null &&
    shouldShowSatisfactionSurvey(new Date(session.user.createdAt).toISOString(), preferences.satisfactionShownAt);
  if (showSatisfactionSurvey) {
    // Marked at render time, not at response time: "shown once" means displayed once,
    // whether or not the account answers (spec's "Measuring the MVP").
    await markSatisfactionSurveyShown();
  }
  const isAdmin = (await requireAdminRoute()) !== null;
  const invoiceImportMode = getInvoiceImportMode(isAdmin);
  const [places, appliances] = await Promise.all([getPlaces(), getAppliances()]);
  const orderedPlaces = [...places].sort(comparePlacesByPropertyType);
  const month = currentMonthKey();
  const placesData = await Promise.all(
    orderedPlaces.map(async (place) => {
      const placeAppliances = appliances.filter((a) => a.placeId === place.id);
      const [obligationRecords, appointments, completions, deferrals] = await Promise.all([
        getObligationRecordsForPlace(place.id),
        getAppointmentsForPlace(place.id),
        getMaintenanceCompletionsForPlace(place.id, month),
        getMaintenanceDeferralsForPlace(place.id),
      ]);
      const counts = getObligationCountsForAppliances(placeAppliances, obligationRecords);
      const maintenanceDue = applyDeferrals(
        filterPendingGuidance(getMaintenanceGuidanceForAppliances(placeAppliances, place.maintenanceLevel), completions),
        placeAppliances,
        place.maintenanceLevel,
        deferrals,
        month
      );
      const maintenanceDueCount = maintenanceDue.length;
      const maintenanceMinutes = maintenanceDue.reduce((sum, { task }) => sum + task.activeMinutes, 0);
      return {
        place,
        appliances: placeAppliances,
        obligationRecords,
        appointments,
        counts,
        maintenanceDueCount,
        maintenanceMinutes,
      };
    })
  );

  const totalCounts = placesData.reduce<ObligationCounts>(
    (acc, { counts }) => ({
      overdue: acc.overdue + counts.overdue,
      toConfirm: acc.toConfirm + counts.toConfirm,
      upToDate: acc.upToDate + counts.upToDate,
    }),
    { overdue: 0, toConfirm: 0, upToDate: 0 }
  );
  const totalMaintenanceDue = placesData.reduce((sum, p) => sum + p.maintenanceDueCount, 0);
  const totalMaintenanceMinutes = placesData.reduce((sum, p) => sum + p.maintenanceMinutes, 0);

  return (
    <>
      <main className={PAGE_CLASS}>
        <header className="flex min-h-11 items-center justify-between gap-4">
          <span className="font-display text-[21px] font-bold tracking-[-0.3px] text-ink">Electro Care</span>
          <Link
            href="/settings"
            aria-label="Paramètres"
            className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-surface text-ink"
          >
            <Icon name="settings" />
          </Link>
        </header>

        <div className="flex flex-col gap-1">
          <p className="text-[15px] text-ink-2">Bonjour</p>
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.4px] text-ink">
            Vos logements, en un coup d&apos;œil
          </h1>
        </div>

        {places.length > 0 && (
          <ComplianceGauge
            counts={totalCounts}
            maintenanceDueCount={totalMaintenanceDue}
            maintenanceMinutes={totalMaintenanceMinutes}
          />
        )}

        {places.length === 0 ? (
          <section className="flex flex-col items-center gap-4 rounded-3xl bg-surface p-8 text-center">
            <p className="text-[15px] text-ink-2">Aucun lieu pour l&apos;instant.</p>
            <Link href="/places/new" className={BUTTON_PRIMARY}>
              Ajouter votre premier lieu
            </Link>
          </section>
        ) : (
          <>
            <UrgentActions placesData={placesData} />

            <Section title="Vos lieux">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {placesData.map(({ place, counts, maintenanceDueCount }) => (
                  <PlaceCard key={place.id} place={place} counts={counts} maintenanceDueCount={maintenanceDueCount} />
                ))}
              </div>
              <AddLink href="/places/new">Ajouter un lieu</AddLink>
            </Section>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {invoiceImportMode === "disabled" ? (
            <span className="px-1 text-sm text-ink-2">Import de factures : bientôt disponible</span>
          ) : (
            <Link href="/import-invoice" className={LINK_ACTION}>
              Importer une facture
            </Link>
          )}
          <SignOutButton />
        </div>
      </main>
      {showSatisfactionSurvey && <SatisfactionSurveyModal />}
    </>
  );
}
