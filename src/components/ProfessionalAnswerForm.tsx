"use client";

import { useState, useTransition } from "react";
import { submitProfessionalAnswer } from "@/app/pro/actions";
import type { ProBookingView } from "@/lib/booking-pro";
import { SLOT_PERIOD_LABELS } from "@/lib/booking-types";
import { formatFrenchDate } from "@/lib/french-dates";
import { BUTTON_DANGER, BUTTON_NEUTRAL, BUTTON_PRIMARY, CARD_CLASS, INPUT_CLASS, SECTION_TITLE_CLASS } from "@/components/ui";

function formatEuros(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} €`;
}

// spec "The professional's answer": confirm one half-day with a time, propose another
// date, or decline; for a quote, a price and the first available date.
export function ProfessionalAnswerForm({ token, view }: { token: string; view: ProBookingView }) {
  const [mode, setMode] = useState<"idle" | "confirm" | "propose" | "quote" | "decline">("idle");
  const [slotIndex, setSlotIndex] = useState(0);
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (view.requestStatus !== "sent") {
    return (
      <p className="rounded-2xl bg-surface p-4 text-sm text-ink-2">
        {view.recipientStatus === "confirmed"
          ? `Rendez-vous confirmé le ${view.proposedDate ? formatFrenchDate(view.proposedDate) : ""}${view.proposedTime ? ` à ${view.proposedTime}` : ""}. Merci !`
          : view.requestStatus === "cancelled"
            ? "Le client a annulé cette demande."
            : "Cette demande est close : le client a retenu une autre réponse. Merci de votre retour."}
      </p>
    );
  }
  if (view.recipientStatus === "declined") {
    return <p className="rounded-2xl bg-surface p-4 text-sm text-ink-2">Vous avez décliné cette demande. Merci de votre réponse.</p>;
  }
  if (view.recipientStatus === "quoted" || view.recipientStatus === "proposed") {
    return (
      <p className="rounded-2xl bg-surface p-4 text-sm text-ink-2">
        Votre réponse a bien été enregistrée
        {view.priceEur !== null ? ` : ${formatEuros(view.priceEur)}` : ""}
        {view.proposedDate ? `, ${formatFrenchDate(view.proposedDate)}${view.proposedTime ? ` à ${view.proposedTime}` : ""}` : ""}. Le
        client vous recontacte s&apos;il la retient.
      </p>
    );
  }

  function send(action: string, payload: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const result = await submitProfessionalAnswer(token, action, payload);
      if (result.error) setError(result.error);
      else setMode("idle");
    });
  }

  return (
    <section className={CARD_CLASS}>
      <h2 className={SECTION_TITLE_CLASS}>Votre réponse</h2>
      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          {view.kind === "quote" ? (
            <button type="button" onClick={() => setMode("quote")} className={BUTTON_PRIMARY}>
              Envoyer un devis
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setMode("confirm")} className={BUTTON_PRIMARY}>
                Confirmer un créneau
              </button>
              <button type="button" onClick={() => setMode("propose")} className={BUTTON_NEUTRAL}>
                Proposer une autre date
              </button>
            </>
          )}
          <button type="button" onClick={() => setMode("decline")} className={BUTTON_DANGER}>
            Refuser
          </button>
        </div>
      )}

      {mode === "confirm" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            send("confirm", { slot_index: slotIndex, time });
          }}
        >
          <ul className="flex flex-col gap-2">
            {view.slots.map((s, i) => (
              <li key={i}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="radio" name="slot" checked={slotIndex === i} onChange={() => setSlotIndex(i)} />
                  {formatFrenchDate(s.date)} {SLOT_PERIOD_LABELS[s.period]}
                </label>
              </li>
            ))}
          </ul>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Heure d&apos;arrivée
            <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={INPUT_CLASS} />
          </label>
          <Buttons isPending={isPending} onCancel={() => setMode("idle")} label="Confirmer" />
        </form>
      )}

      {mode === "propose" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            send("propose", { date, time, note });
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Date proposée
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLASS} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Heure (facultatif)
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT_CLASS} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Message (facultatif)
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={INPUT_CLASS} />
          </label>
          <Buttons isPending={isPending} onCancel={() => setMode("idle")} label="Proposer" />
        </form>
      )}

      {mode === "quote" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            send("quote", { price_eur: price, date, time, note });
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Prix TTC (en euros)
            <input type="number" min="0" step="1" required value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT_CLASS} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Première date disponible
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLASS} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Heure (facultatif)
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT_CLASS} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Précisions (facultatif)
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={INPUT_CLASS} />
          </label>
          <Buttons isPending={isPending} onCancel={() => setMode("idle")} label="Envoyer le devis" />
        </form>
      )}

      {mode === "decline" && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            send("decline", { note });
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Motif (facultatif)
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={INPUT_CLASS} />
          </label>
          <Buttons isPending={isPending} onCancel={() => setMode("idle")} label="Refuser la demande" danger />
        </form>
      )}

      {error && <p className="text-sm text-late">{error}</p>}
    </section>
  );
}

function Buttons({ isPending, onCancel, label, danger = false }: { isPending: boolean; onCancel: () => void; label: string; danger?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={isPending} className={danger ? BUTTON_DANGER : BUTTON_PRIMARY}>
        {isPending ? "…" : label}
      </button>
      <button type="button" onClick={onCancel} className={BUTTON_NEUTRAL}>
        Retour
      </button>
    </div>
  );
}
