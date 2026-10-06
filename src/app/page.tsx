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

        <section className="flex flex-col gap-2 rounded-3xl bg-surface p-5">
          <h2 className={SECTION_TITLE_CLASS}>Votre logement, entretenu et en règle</h2>
          <p className="text-[15px] leading-relaxed text-ink-2">
            Chaudière, ramonage, détecteur de fumée, fosse septique : certains entretiens sont
            obligatoires, et les oublier peut coûter une amende ou un refus d&apos;indemnisation de
            votre assureur. Electro Care établit la liste de vos obligations en quelques questions,
            vous signale chaque échéance et vous guide pour l&apos;entretien courant de vos appareils.
            Gratuit.
          </p>
        </section>

        <DemoDashboard />
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
