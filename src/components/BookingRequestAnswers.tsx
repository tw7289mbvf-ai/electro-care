"use client";

import { useState, useTransition } from "react";
import { cancelBookingRequestAction, chooseBookingAnswerAction } from "@/app/booking-actions";
import { liveRecipients, type BookingRecipient, type BookingRequest } from "@/lib/booking-types";
import { formatFrenchDate } from "@/lib/french-dates";
import { BUTTON_DANGER, BUTTON_PRIMARY, CARD_CLASS, SECTION_TITLE_CLASS } from "@/components/ui";

function formatEuros(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} €`;
}

const STATUS_LABELS: Record<BookingRecipient["status"], string> = {
  pending: "En attente de réponse",
  confirmed: "Rendez-vous confirmé",
  proposed: "Autre date proposée",
  quoted: "Devis reçu",
  declined: "A refusé",
  not_chosen: "Non retenu",
  replaced: "Remplacé",
};

// Answers side by side (professional, price, proposed date), "Choisir" on each one that
// can be chosen, "Annuler la demande" while it is open (spec "Statuses").
export function BookingRequestAnswers({ request }: { request: BookingRequest }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const recipients = liveRecipients(request);
  const open = request.status === "sent";

  function choose(recipientId: string) {
    setError(null);
    startTransition(async () => {
      const result = await chooseBookingAnswerAction(request.id, recipientId);
      if (result.error) setError(result.error);
    });
  }

  function cancel() {
    if (!window.confirm("Annuler cette demande ? Les professionnels n'y répondront plus.")) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelBookingRequestAction(request.id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className={SECTION_TITLE_CLASS}>
        {request.kind === "quote" ? "Réponses des professionnels" : "Réponse du professionnel"}
      </h2>
      {recipients.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-ink-2">
          Aucun professionnel attribué pour l&apos;instant. Electro Care vous en propose un dès que possible.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {recipients.map((r) => {
            const choosable = open && (r.status === "quoted" || r.status === "proposed") && r.proposedDate;
            return (
              <li key={r.id} className={CARD_CLASS}>
                <div>
                  <p className="text-base font-semibold text-ink">{r.providerName}</p>
                  {r.providerCity && <p className="text-[13px] text-ink-2">{r.providerCity}</p>}
                </div>
                <p className="text-sm text-ink-2">{STATUS_LABELS[r.status]}</p>
                {r.priceEur !== null && <p className="text-xl font-semibold text-ink">{formatEuros(r.priceEur)}</p>}
                {r.proposedDate && (
                  <p className="text-sm text-ink">
                    {r.status === "quoted" ? "Première date : " : "Date : "}
                    {formatFrenchDate(r.proposedDate)}
                    {r.proposedTime ? ` à ${r.proposedTime}` : ""}
                  </p>
                )}
                {r.answerNote && <p className="text-sm text-ink-2">« {r.answerNote} »</p>}
                {choosable && (
                  <button type="button" disabled={isPending} onClick={() => choose(r.id)} className={`${BUTTON_PRIMARY} self-start`}>
                    Choisir
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="text-sm text-late">{error}</p>}
      {open && (
        <button type="button" disabled={isPending} onClick={cancel} className={`${BUTTON_DANGER} self-start`}>
          Annuler la demande
        </button>
      )}
    </section>
  );
}
