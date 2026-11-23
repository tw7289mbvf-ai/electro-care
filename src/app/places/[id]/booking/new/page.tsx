import { notFound } from "next/navigation";
import { getPlace } from "@/lib/places";
import { getAppliances } from "@/lib/appliances";
import { getObligationRecordsForPlace } from "@/lib/appliance-obligations";
import { getObligationsForAppliance } from "@/lib/obligations";
import { getMaintenanceTask, BOOKING_TRADE_LABELS } from "@/lib/maintenance-tasks";
import { getEquipmentType } from "@/lib/equipment-types";
import { getLegalObligationsForType } from "@/lib/legal-obligations";
import { getApplianceDisplayName } from "@/lib/appliance-display";
import { getLastBookingPhone, listBookableProfessionals, type BookingDetails } from "@/lib/booking-requests";
import { buildRequestMailto } from "@/lib/email/reminder-email";
import { BookingRequestForm, type BookableObligationOption } from "@/components/BookingRequestForm";
import { CopyTextButton } from "@/components/CopyTextButton";
import { BackLink, BUTTON_PRIMARY, PAGE_CLASS, PAGE_TITLE_CLASS } from "@/components/ui";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Boiler fuel and sweeping appliance kind, deduced from the equipment type and still
// editable in the form (spec "The form": "the fuel for a boiler; the appliance type and
// the number of flues for sweeping").
const FUEL_BY_TYPE: Record<string, string> = { "CH-01": "Gaz", "CH-02": "Fioul", "CH-03": "Bois / granulés", "ECS-03": "Gaz" };
const KIND_BY_TYPE: Record<string, string> = {
  "CH-03": "Chaudière bois",
  "CH-04": "Poêle à granulés",
  "CH-05": "Poêle à bois ou insert",
  "CH-06": "Cheminée ouverte",
};

export default async function NewBookingRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ appliance?: string; task?: string }>;
}) {
  const { id } = await params;
  const { appliance: applianceId, task: taskId } = await searchParams;
  if (!UUID_PATTERN.test(id) || !applianceId || !UUID_PATTERN.test(applianceId) || !taskId) notFound();
  const task = getMaintenanceTask(taskId);
  if (!task?.bookingTrade) notFound();
  const trade = task.bookingTrade;

  const place = await getPlace(id);
  if (!place) notFound();
  const [allAppliances, records, lastPhone] = await Promise.all([getAppliances(), getObligationRecordsForPlace(id), getLastBookingPhone()]);
  const appliances = allAppliances.filter((a) => a.placeId === id);
  const appliance = appliances.find((a) => a.id === applianceId);
  if (!appliance?.equipmentTypeId) notFound();

  // Every bookable obligation of this trade in the place, the requested one first
  // (spec "Grouping": one visit for the boiler and its flue).
  const options: BookableObligationOption[] = appliances
    .filter((a) => a.equipmentTypeId)
    .flatMap((a) => {
      const views = getObligationsForAppliance(a.equipmentTypeId!, records.filter((r) => r.applianceId === a.id), a.powerKw);
      return views
        .filter((v) => v.task.bookingTrade === trade && v.status !== "not_applicable")
        .map((v) => {
          const record = records.find((r) => r.applianceId === a.id && r.maintenanceTaskId === v.task.id);
          return {
            applianceId: a.id,
            maintenanceTaskId: v.task.id,
            taskTitle: v.task.title,
            applianceLabel: getApplianceDisplayName(a),
            providerName: record?.providerName ?? null,
            providerContact: record?.providerContact ?? null,
          };
        });
    })
    .sort((a, b) => Number(b.applianceId === applianceId && b.maintenanceTaskId === taskId) - Number(a.applianceId === applianceId && a.maintenanceTaskId === taskId));
  const primary = options.find((o) => o.applianceId === applianceId && o.maintenanceTaskId === taskId);
  if (!primary) notFound();

  const professionals = place.postcode
    ? await listBookableProfessionals(trade, place.postcode, options.map((o) => o.maintenanceTaskId))
    : [];
  const knownProvider = primary.providerName
    ? { name: primary.providerName, contact: primary.providerContact }
    : (options.find((o) => o.providerName)?.providerName
        ? { name: options.find((o) => o.providerName)!.providerName!, contact: options.find((o) => o.providerName)!.providerContact }
        : null);

  const primaryRecord = records.find((r) => r.applianceId === applianceId && r.maintenanceTaskId === taskId);
  const details: BookingDetails = {
    brand: appliance.brand,
    model: appliance.model,
    year: appliance.purchaseDate ? appliance.purchaseDate.slice(0, 4) : null,
    lastService: primaryRecord?.lastServiceDate ? primaryRecord.lastServiceDate.slice(0, 7) : null,
    fuel: trade === "chauffagiste" ? (FUEL_BY_TYPE[appliance.equipmentTypeId] ?? null) : null,
    applianceKind: trade === "ramoneur" ? (KIND_BY_TYPE[appliance.equipmentTypeId] ?? null) : null,
    flueCount: trade === "ramoneur" ? "1" : null,
  };

  const title = `${task.title} — ${primary.applianceLabel}`;

  // No listed professional covers the place and no provider is known: the existing
  // ready-to-send request (the one the reminder e-mail links to), in the app, with a
  // word on why (spec "Choosing the professional": "elsewhere, only the user's own
  // provider and the ready-to-send request are offered").
  if (professionals.length === 0 && !knownProvider) {
    const equipment = getEquipmentType(appliance.equipmentTypeId);
    const mailto = buildRequestMailto("intervention", {
      applianceId: appliance.id,
      equipmentLabel: equipment?.label ?? primary.applianceLabel,
      brand: appliance.brand,
      model: appliance.model,
      taskTitle: task.title,
      legalBasis: getLegalObligationsForType(appliance.equipmentTypeId)[0]?.legalText ?? null,
      placeAddress: place.streetAddress
        ? [place.streetAddress, place.addressComplement, [place.postcode, place.commune].filter(Boolean).join(" ")].filter(Boolean).join(", ")
        : null,
      providerEmail: null,
    });
    const mailtoHref = `mailto:?subject=${encodeURIComponent(mailto.subject)}&body=${encodeURIComponent(mailto.body)}`;
    return (
      <main className={PAGE_CLASS}>
        <BackLink href={`/places/${place.id}`}>{place.name}</BackLink>
        <div>
          <h1 className={PAGE_TITLE_CLASS}>Demande d&apos;intervention</h1>
          <p className="mt-1 text-sm text-ink-2">{title}</p>
        </div>
        <p className="rounded-2xl bg-accent-soft p-4 text-[15px] text-ink">
          Nous n&apos;avons pas encore de professionnel référencé dans votre commune. Voici une demande prête à
          envoyer au professionnel de votre choix.
        </p>
        <pre className="whitespace-pre-wrap rounded-[20px] bg-surface p-4 text-sm text-ink">{mailto.body}</pre>
        <div className="flex flex-wrap gap-3">
          <a href={mailtoHref} className={BUTTON_PRIMARY}>
            Ouvrir dans ma messagerie
          </a>
          <CopyTextButton text={mailto.body} />
        </div>
      </main>
    );
  }

  return (
    <main className={PAGE_CLASS}>
      <BackLink href={`/places/${place.id}`}>{place.name}</BackLink>
      <div>
        <h1 className={PAGE_TITLE_CLASS}>Prendre rendez-vous</h1>
        <p className="mt-1 text-sm text-ink-2">
          {title} · {BOOKING_TRADE_LABELS[trade]}
        </p>
      </div>
      <BookingRequestForm
        placeId={place.id}
        trade={trade}
        primaryKey={`${primary.applianceId}:${primary.maintenanceTaskId}`}
        options={options}
        professionals={professionals}
        knownProvider={knownProvider}
        details={details}
        lastPhone={lastPhone}
        addressMissing={!place.streetAddress}
        placeAddress={[place.streetAddress, place.addressComplement, [place.postcode, place.commune].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
      />
    </main>
  );
}
