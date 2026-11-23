import { notFound } from "next/navigation";
import { getBookingRequest, liveRecipients, allDeclined, isWaitingTooLong, SLOT_PERIOD_LABELS } from "@/lib/booking-requests";
import { BOOKING_TRADE_LABELS } from "@/lib/maintenance-tasks";
import { formatFrenchDate } from "@/lib/french-dates";
import { BookingRequestAnswers } from "@/components/BookingRequestAnswers";
import { BackLink, CARD_CLASS, PAGE_CLASS, PAGE_TITLE_CLASS, Pill, SECTION_TITLE_CLASS } from "@/components/ui";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The owner's view of one request (spec "Statuses"): answers side by side, "Choisir"
// on each, "Annuler la demande". The place page keeps the short status chip.
export default async function BookingRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const request = await getBookingRequest(id);
  if (!request) notFound();

  const recipients = liveRecipients(request);
  const confirmed = recipients.find((r) => r.status === "confirmed");
  const headline =
    request.status === "confirmed" && confirmed
      ? { tone: "accent" as const, text: `Rendez-vous confirmé le ${formatFrenchDate(confirmed.proposedDate!)}${confirmed.proposedTime ? ` à ${confirmed.proposedTime}` : ""} avec ${confirmed.providerName}` }
      : request.status === "cancelled"
        ? { tone: "neutral" as const, text: "Demande annulée" }
        : request.status === "closed"
          ? { tone: "neutral" as const, text: "Demande close" }
          : allDeclined(request)
            ? { tone: "late" as const, text: "Demande refusée" }
            : isWaitingTooLong(request)
              ? { tone: "warn" as const, text: "Sans réponse depuis 3 jours ouvrés" }
              : request.firstAvailable && recipients.length === 0
                ? { tone: "accent" as const, text: "Demande envoyée : nous cherchons le premier professionnel disponible" }
                : { tone: "accent" as const, text: "Demande envoyée" };

  return (
    <main className={PAGE_CLASS}>
      <BackLink href={`/places/${request.placeId}`}>Retour au lieu</BackLink>
      <div className="flex flex-col gap-2">
        <h1 className={PAGE_TITLE_CLASS}>{request.kind === "quote" ? "Demande de devis" : "Demande de rendez-vous"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={headline.tone}>{headline.text}</Pill>
          <span className="text-sm text-ink-2">
            {BOOKING_TRADE_LABELS[request.trade]} · envoyée le {formatFrenchDate(request.createdAt)}
          </span>
        </div>
      </div>

      <section className={CARD_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Votre demande</h2>
        <ul className="flex flex-col gap-1 text-sm text-ink">
          {request.items.map((item) => (
            <li key={`${item.applianceId}-${item.maintenanceTaskId}`}>
              {item.taskTitle} <span className="text-ink-2">· {item.applianceLabel}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink-2">
          Créneaux souhaités :{" "}
          {request.slots.map((s) => `${formatFrenchDate(s.date)} ${SLOT_PERIOD_LABELS[s.period]}`).join(", ")}
        </p>
        <p className="text-sm text-ink-2">
          {request.address} · {request.phone}
        </p>
        {request.comment && <p className="text-sm text-ink-2">« {request.comment} »</p>}
      </section>

      <BookingRequestAnswers request={request} />
    </main>
  );
}
