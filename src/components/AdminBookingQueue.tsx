"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminBookingRecipient, AdminBookingRequest, AdminProfessional } from "@/lib/booking-admin";
import { BOOKING_TRADE_LABELS } from "@/lib/maintenance-tasks";
import { NO_ANSWER_BUSINESS_DAYS, SLOT_PERIOD_LABELS } from "@/lib/booking-types";
import { isPastBusinessDays } from "@/lib/business-days";
import { formatFrenchDate } from "@/lib/french-dates";
import { BUTTON_DANGER, BUTTON_NEUTRAL, BUTTON_PRIMARY, INPUT_CLASS } from "@/components/ui";

const INPUT_SMALL = `${INPUT_CLASS} text-sm`;

const REQUEST_STATUS_LABELS: Record<AdminBookingRequest["status"], string> = {
  sent: "En cours",
  confirmed: "Confirmée",
  cancelled: "Annulée par l'utilisateur",
  closed: "Close",
};
const RECIPIENT_STATUS_LABELS: Record<AdminBookingRecipient["status"], string> = {
  pending: "Sans réponse",
  confirmed: "Confirmé",
  proposed: "Autre date proposée",
  quoted: "Devis reçu",
  declined: "Refus",
  not_chosen: "Non retenu",
  replaced: "Remplacé",
};
const DETAIL_LABELS: Record<string, string> = {
  brand: "Marque",
  model: "Modèle",
  year: "Année",
  lastService: "Dernier entretien",
  fuel: "Énergie",
  applianceKind: "Type d'appareil",
  flueCount: "Conduits",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ageLabel(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  return `il y a ${days} jour${days > 1 ? "s" : ""}`;
}

async function postAdmin(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; url?: string }> {
  const res = await fetch("/admin/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as { error?: string; url?: string } | null;
  if (!res.ok) return { ok: false, error: json?.error ?? "Une erreur est survenue." };
  return { ok: true, ...json };
}

// An answer received by phone, typed by the owner for the professional (spec "Request
// queue": "records by hand the answer received by phone: price, date or decline").
function ManualAnswerForm({ request, recipient, onDone }: { request: AdminBookingRequest; recipient: AdminBookingRecipient; onDone: () => void }) {
  const router = useRouter();
  const [answer, setAnswer] = useState<"confirm" | "propose" | "quote" | "decline">(request.kind === "quote" ? "quote" : "confirm");
  const [slotIndex, setSlotIndex] = useState(0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const payload: Record<string, unknown> = { note };
    if (answer === "confirm") Object.assign(payload, { slot_index: slotIndex, time });
    if (answer === "propose") Object.assign(payload, { date, time });
    if (answer === "quote") Object.assign(payload, { price_eur: price, date, time });
    startTransition(async () => {
      const result = await postAdmin({ action: "booking-answer", recipientId: recipient.id, answer, payload });
      if (!result.ok) {
        setError(result.error ?? null);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3 text-sm"
    >
      <select value={answer} onChange={(e) => setAnswer(e.target.value as typeof answer)} className={INPUT_SMALL}>
        <option value="confirm">Confirme un créneau</option>
        <option value="propose">Propose une autre date</option>
        <option value="quote">Donne un prix (devis)</option>
        <option value="decline">Refuse</option>
      </select>
      {answer === "confirm" && (
        <select value={slotIndex} onChange={(e) => setSlotIndex(Number(e.target.value))} className={INPUT_SMALL}>
          {request.slots.map((s, i) => (
            <option key={i} value={i}>
              {formatFrenchDate(s.date)} {SLOT_PERIOD_LABELS[s.period]}
            </option>
          ))}
        </select>
      )}
      {(answer === "propose" || answer === "quote") && (
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_SMALL} aria-label="Date" />
      )}
      {answer !== "decline" && <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT_SMALL} aria-label="Heure" />}
      {answer === "quote" && (
        <input type="number" min="0" step="1" required placeholder="Prix en euros" value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT_SMALL} />
      )}
      <input type="text" placeholder="Note (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} className={INPUT_SMALL} />
      {error && <p className="text-late">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={BUTTON_PRIMARY}>
          {isPending ? "…" : "Enregistrer"}
        </button>
        <button type="button" onClick={onDone} className={BUTTON_NEUTRAL}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function ProfessionalPicker({
  request,
  professionals,
  replaceRecipientId,
  onDone,
}: {
  request: AdminBookingRequest;
  professionals: AdminProfessional[];
  replaceRecipientId: string | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [professionalId, setProfessionalId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const already = new Set(request.recipients.filter((r) => r.status !== "replaced").map((r) => r.professionalId));
  const candidates = professionals
    .filter((p) => p.active && p.status !== "refus" && p.trades.includes(request.trade) && !already.has(p.id))
    .sort((a, b) => Number(request.postcode ? b.postalCodesCovered.includes(request.postcode) : 0) - Number(request.postcode ? a.postalCodesCovered.includes(request.postcode) : 0));

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await postAdmin({ action: "booking-add-recipient", requestId: request.id, professionalId, replaceRecipientId });
      if (!result.ok) {
        setError(result.error ?? null);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3 text-sm"
    >
      <select required value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={`${INPUT_SMALL} flex-1`}>
        <option value="">Choisir un professionnel…</option>
        {candidates.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.city ?? "?"}
            {request.postcode && !p.postalCodesCovered.includes(request.postcode) ? " (hors secteur)" : ""}
          </option>
        ))}
      </select>
      <button type="submit" disabled={isPending || !professionalId} className={BUTTON_PRIMARY}>
        {replaceRecipientId ? "Remplacer" : "Ajouter"}
      </button>
      <button type="button" onClick={onDone} className={BUTTON_NEUTRAL}>
        Annuler
      </button>
      {error && <p className="w-full text-late">{error}</p>}
    </form>
  );
}

function RequestCard({ request, professionals }: { request: AdminBookingRequest; professionals: AdminProfessional[] }) {
  const router = useRouter();
  const [panel, setPanel] = useState<{ kind: "answer" | "replace"; recipientId: string } | { kind: "add" } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const live = request.recipients.filter((r) => r.status !== "replaced");
  const answered = live.some((r) => r.status === "quoted" || r.status === "proposed" || r.status === "confirmed");
  const stale = request.status === "sent" && !answered && isPastBusinessDays(request.createdAt, NO_ANSWER_BUSINESS_DAYS, todayIso());
  const needsAssignment = request.status === "sent" && live.length === 0;
  const details = Object.entries(request.details ?? {}).filter(([, v]) => v) as [string, string][];

  function copyLink(recipientId: string) {
    setError(null);
    startTransition(async () => {
      const result = await postAdmin({ action: "booking-link", recipientId });
      if (!result.ok || !result.url) {
        setError(result.error ?? "Lien indisponible.");
        return;
      }
      try {
        await navigator.clipboard.writeText(result.url);
        setCopied(recipientId);
        setTimeout(() => setCopied(null), 2000);
      } catch {
        window.prompt("Copiez ce lien :", result.url);
      }
      router.refresh();
    });
  }

  function close() {
    if (!window.confirm("Clore cette demande ? L'utilisateur la verra comme close.")) return;
    startTransition(async () => {
      const result = await postAdmin({ action: "booking-close", requestId: request.id });
      if (!result.ok) setError(result.error ?? null);
      else router.refresh();
    });
  }

  return (
    <li className={`flex flex-col gap-3 rounded-2xl p-4 text-sm ${stale || needsAssignment ? "bg-warn-soft" : "bg-surface"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-ink">
            {request.kind === "quote" ? "Devis" : "Rendez-vous"} · {BOOKING_TRADE_LABELS[request.trade]}
          </p>
          <p className="text-ink-2">
            {REQUEST_STATUS_LABELS[request.status]} · envoyée {ageLabel(request.createdAt)} ({formatFrenchDate(request.createdAt)})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {stale && <span className="rounded-full bg-warn px-2 py-0.5 text-[13px] font-medium text-on-accent">Sans réponse depuis 3 jours ouvrés</span>}
          {needsAssignment && <span className="rounded-full bg-warn px-2 py-0.5 text-[13px] font-medium text-on-accent">Premier disponible : à attribuer</span>}
        </div>
      </div>

      <ul className="flex flex-col gap-0.5 text-ink">
        {request.items.map((item, i) => (
          <li key={i}>
            {item.taskTitle} <span className="text-ink-2">· {item.applianceLabel}</span>
          </li>
        ))}
      </ul>
      <p className="text-ink">
        {request.address} · {request.phone}
      </p>
      <p className="text-ink-2">Créneaux : {request.slots.map((s) => `${formatFrenchDate(s.date)} ${SLOT_PERIOD_LABELS[s.period]}`).join(", ")}</p>
      {details.length > 0 && <p className="text-ink-2">{details.map(([k, v]) => `${DETAIL_LABELS[k] ?? k} : ${v}`).join(" · ")}</p>}
      {request.comment && <p className="text-ink-2">« {request.comment} »</p>}

      <div className="flex flex-col gap-2">
        <p className="font-semibold text-ink">Destinataires</p>
        {live.length === 0 && <p className="text-ink-2">Aucun pour l&apos;instant.</p>}
        <ul className="flex flex-col gap-2">
          {live.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-semibold text-ink">{r.providerName}</span>
                  {r.providerCity && <span className="text-ink-2"> · {r.providerCity}</span>}
                  {r.providerContact && <span className="text-ink-2"> · {r.providerContact}</span>}
                  {!r.professionalId && <span className="text-ink-2"> · prestataire de l&apos;utilisateur</span>}
                </span>
                <span className="text-ink-2">
                  {RECIPIENT_STATUS_LABELS[r.status]}
                  {r.priceEur !== null ? ` · ${r.priceEur} €` : ""}
                  {r.proposedDate ? ` · ${formatFrenchDate(r.proposedDate)}${r.proposedTime ? ` ${r.proposedTime}` : ""}` : ""}
                  {r.answeredBy === "admin" ? " (saisi à la main)" : ""}
                </span>
              </div>
              {r.answerNote && <p className="text-ink-2">« {r.answerNote} »</p>}
              {request.status === "sent" && r.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={isPending} onClick={() => copyLink(r.id)} className={BUTTON_NEUTRAL}>
                    {copied === r.id ? "Lien copié" : "Copier le lien"}
                  </button>
                  <button type="button" onClick={() => setPanel({ kind: "answer", recipientId: r.id })} className={BUTTON_NEUTRAL}>
                    Saisir une réponse
                  </button>
                  {r.professionalId && (
                    <button type="button" onClick={() => setPanel({ kind: "replace", recipientId: r.id })} className={BUTTON_NEUTRAL}>
                      Remplacer
                    </button>
                  )}
                </div>
              )}
              {panel?.kind === "answer" && panel.recipientId === r.id && <ManualAnswerForm request={request} recipient={r} onDone={() => setPanel(null)} />}
              {panel?.kind === "replace" && panel.recipientId === r.id && (
                <ProfessionalPicker request={request} professionals={professionals} replaceRecipientId={r.id} onDone={() => setPanel(null)} />
              )}
            </li>
          ))}
        </ul>
        {request.status === "sent" && panel?.kind === "add" && (
          <ProfessionalPicker request={request} professionals={professionals} replaceRecipientId={null} onDone={() => setPanel(null)} />
        )}
      </div>

      {error && <p className="text-late">{error}</p>}
      {request.status === "sent" && (
        <div className="flex flex-wrap gap-2">
          {panel?.kind !== "add" && (
            <button type="button" onClick={() => setPanel({ kind: "add" })} className={BUTTON_PRIMARY}>
              {needsAssignment ? "Attribuer un professionnel" : "Ajouter un professionnel"}
            </button>
          )}
          <button type="button" disabled={isPending} onClick={close} className={BUTTON_DANGER}>
            Clore la demande
          </button>
        </div>
      )}
    </li>
  );
}

export function AdminBookingQueue({ requests, professionals }: { requests: AdminBookingRequest[]; professionals: AdminProfessional[] }) {
  if (requests.length === 0) return <p className="text-sm text-ink-2">Aucune demande pour l&apos;instant.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {requests.map((request) => (
        <RequestCard key={request.id} request={request} professionals={professionals} />
      ))}
    </ul>
  );
}
