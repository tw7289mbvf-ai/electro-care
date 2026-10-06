import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/appliance-types";
import { PROPERTY_TYPE_LABELS } from "@/lib/place-types";
import { getPlace } from "@/lib/places";
import { getAppliances } from "@/lib/appliances";
import { getObligationRecordsForPlace } from "@/lib/appliance-obligations";
import { getAppointmentsForPlace } from "@/lib/obligation-appointments";
import { getPlaceChecks } from "@/lib/place-checks";
import { getMaintenanceCompletionsForPlace } from "@/lib/maintenance-completions";
import { getMaintenanceDeferralsForPlace } from "@/lib/maintenance-deferrals";
import {
  getMaintenanceGuidanceForAppliances,
  filterPendingGuidance,
  applyDeferrals,
  canDeferMaintenanceTask,
} from "@/lib/maintenance-guidance";
import { estimateMaintenanceMinutesForAllLevels } from "@/lib/maintenance-levels";
import { currentMonthKey } from "@/lib/french-dates";
import { getInvoiceImportMode } from "@/lib/invoice-extraction";
import { requireAdminRoute } from "@/lib/admin";
import { ObligationsBlock } from "@/components/ObligationsBlock";
import { MaintenanceGuidanceList } from "@/components/MaintenanceGuidanceList";
import { MaintenanceLevelPicker } from "@/components/MaintenanceLevelPicker";
import { ApplianceList } from "@/components/ApplianceList";
import { getObligationCountsForAppliances } from "@/lib/obligations";
import {
  AddLink,
  BackLink,
  BUTTON_SURFACE,
  BUTTON_PRIMARY,
  LINK_ACTION,
  GROUP_LABEL_CLASS,
  PAGE_CLASS,
  PAGE_TITLE_CLASS,
  Pill,
  Section,
  SegmentedBar,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  const place = await getPlace(id);
  if (!place) {
    notFound();
  }

  const month = currentMonthKey();
  const [allAppliances, obligationRecords, appointments, placeChecks, completions, deferrals] = await Promise.all([
    getAppliances(),
    getObligationRecordsForPlace(id),
    getAppointmentsForPlace(id),
    getPlaceChecks(id),
    getMaintenanceCompletionsForPlace(id, month),
    getMaintenanceDeferralsForPlace(id),
  ]);
  const appliances = allAppliances.filter((a) => a.placeId === id);
  const guidance = applyDeferrals(
    filterPendingGuidance(getMaintenanceGuidanceForAppliances(appliances, place.maintenanceLevel), completions),
    appliances,
    place.maintenanceLevel,
    deferrals,
    month
  );
  const deferralByTask = new Map(deferrals.map((d) => [`${d.applianceId}:${d.maintenanceTaskId}`, d]));
  const deferrableTaskKeys = new Set(
    guidance
      .filter(({ appliance, task }) =>
        canDeferMaintenanceTask(task, deferralByTask.get(`${appliance.id}:${task.id}`) ?? null, month)
      )
      .map(({ appliance, task }) => `${appliance.id}:${task.id}`)
  );
  const levelEstimates = estimateMaintenanceMinutesForAllLevels(
    appliances.map((a) => a.equipmentTypeId).filter((typeId): typeId is string => typeId !== null)
  );
  const isAdmin = (await requireAdminRoute()) !== null;
  const invoiceImportMode = getInvoiceImportMode(isAdmin);

  const byCategory = CATEGORIES.map((category) => ({
    category,
    appliances: appliances.filter((a) => a.category === category),
  })).filter((group) => group.appliances.length > 0);

  const counts = getObligationCountsForAppliances(appliances, obligationRecords);
  const locality = [place.postcode, place.commune].filter(Boolean).join(" ");

  return (
    <main className={PAGE_CLASS}>
      <header className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <BackLink href="/">Accueil</BackLink>
          <Link href={`/places/${place.id}/edit`} className={BUTTON_SURFACE}>
            Modifier
          </Link>
        </div>
        <h1 className={`${PAGE_TITLE_CLASS} text-[30px]`}>{place.name}</h1>
        {(place.propertyType || locality) && (
          <div className="flex flex-wrap items-center gap-2">
            {place.propertyType && <Pill tone="accent">{PROPERTY_TYPE_LABELS[place.propertyType]}</Pill>}
            {locality && <span className="text-sm text-ink-2">{locality}</span>}
          </div>
        )}
        <div className="mt-1.5">
          <SegmentedBar counts={counts} thin />
        </div>
        {!place.onboardedAt && (
          <Link href={`/places/${place.id}/questionnaire`} className={`${BUTTON_PRIMARY} mt-1 self-start`}>
            Compléter le questionnaire pour ce lieu
          </Link>
        )}
      </header>

      <MaintenanceLevelPicker placeId={place.id} level={place.maintenanceLevel} estimates={levelEstimates} />

      <ObligationsBlock
        appliances={appliances}
        obligationRecords={obligationRecords}
        appointments={appointments}
        placeChecks={placeChecks}
      />

      <MaintenanceGuidanceList items={guidance} placeId={id} deferrableTaskKeys={deferrableTaskKeys} />

      <Section title="Appareils">
        {byCategory.length === 0 ? (
          <p className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-2">Aucun appareil pour l&apos;instant.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {byCategory.map(({ category, appliances: categoryAppliances }) => (
              <div key={category} className="flex flex-col gap-2">
                <h3 className={GROUP_LABEL_CLASS}>{CATEGORY_LABELS[category]}</h3>
                <ApplianceList appliances={categoryAppliances} />
              </div>
            ))}
          </div>
        )}
        <AddLink href={`/places/${place.id}/appliances/new`}>Ajouter un appareil</AddLink>
        {invoiceImportMode === "disabled" ? (
          <p className="px-1 text-sm text-ink-2">Import de factures : bientôt disponible</p>
        ) : (
          <Link href={`/places/${place.id}/import-invoice`} className={`${LINK_ACTION} self-start`}>
            Importer une facture
          </Link>
        )}
      </Section>
    </main>
  );
}
