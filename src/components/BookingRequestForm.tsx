"use client";

import { useState, useTransition } from "react";
import { submitBookingRequest } from "@/app/booking-actions";
import type { BookableProfessional, BookingDetails, BookingKind, BookingSlot, SlotPeriod } from "@/lib/booking-types";
import type { BookingTrade } from "@/lib/maintenance-tasks";
import { BUTTON_PRIMARY, CARD_CLASS, INPUT_CLASS, SECTION_TITLE_CLASS } from "@/components/ui";

export type BookableObligationOption = {
  applianceId: string;
  maintenanceTaskId: string;
  taskTitle: string;
  applianceLabel: string;
  providerName: string | null;
  providerContact: string | null;
};

const KNOWN = "known";
const FIRST = "first";
const MAX_QUOTES = 3;

const FUEL_OPTIONS = ["Gaz", "Fioul", "Bois / granulés", "Électricité"];
const KIND_OPTIONS = ["Poêle à bois ou insert", "Poêle à granulés", "Cheminée ouverte", "Chaudière bois", "Chaudière gaz ou fioul"];

const CONSENT_TEXT =
  "J'accepte que mon adresse, mon téléphone et les informations de cet appareil soient transmis aux professionnels que j'ai choisis et visibles par l'équipe Electro Care pour traiter ma demande.";

function todayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatEuros(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} €`;
}

// One prefilled field with its "Je ne sais pas" (spec: every appliance field optional).
function DetailField({
  label,
  value,
  onChange,
  options,
  type = "text",
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options?: string[];
  type?: string;
}) {
  const unknown = value === null;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-ink">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        {options ? (
          <select value={unknown ? "" : value} onChange={(e) => onChange(e.target.value)} disabled={unknown} className={`${INPUT_CLASS} flex-1`}>
            <option value="">—</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input type={type} value={unknown ? "" : value} onChange={(e) => onChange(e.target.value)} disabled={unknown} className={`${INPUT_CLASS} flex-1`} />
        )}
        <label className="flex items-center gap-1.5 text-sm text-ink-2">
          <input type="checkbox" checked={unknown} onChange={(e) => onChange(e.target.checked ? null : "")} />
          Je ne sais pas
        </label>
      </div>
    </div>
  );
}

export function BookingRequestForm({
  placeId,
  trade,
  primaryKey,
  options,
  professionals,
  knownProvider,
  details: initialDetails,
  lastPhone,
  addressMissing,
  placeAddress,
}: {
  placeId: string;
  trade: BookingTrade;
  primaryKey: string;
  options: BookableObligationOption[];
  professionals: BookableProfessional[];
  knownProvider: { name: string; contact: string | null } | null;
  details: BookingDetails;
  lastPhone: string | null;
  addressMissing: boolean;
  placeAddress: string;
}) {
  const [kind, setKind] = useState<BookingKind>("appointment");
  const [recipients, setRecipients] = useState<string[]>(knownProvider ? [KNOWN] : []);
  const [items, setItems] = useState<Set<string>>(new Set([primaryKey]));
  const [details, setDetails] = useState<BookingDetails>(initialDetails);
  const [slots, setSlots] = useState<{ date: string; period: SlotPeriod }[]>([
    { date: "", period: "morning" },
    { date: "", period: "morning" },
    { date: "", period: "morning" },
  ]);
  const [phone, setPhone] = useState(lastPhone ?? "");
  const [comment, setComment] = useState("");
  const [street, setStreet] = useState("");
  const [complement, setComplement] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedTaskIds = options.filter((o) => items.has(`${o.applianceId}:${o.maintenanceTaskId}`)).map((o) => o.maintenanceTaskId);
  const primary = options.find((o) => `${o.applianceId}:${o.maintenanceTaskId}` === primaryKey)!;

  function priceLabel(pro: BookableProfessional): string {
    const known = selectedTaskIds.map((t) => pro.prices[t]).filter((p): p is number => typeof p === "number");
    if (known.length === selectedTaskIds.length && known.length > 0) return formatEuros(known.reduce((a, b) => a + b, 0));
    const primaryPrice = pro.prices[primary.maintenanceTaskId];
    if (typeof primaryPrice === "number") return `à partir de ${formatEuros(primaryPrice)}`;
    return "Prix sur devis";
  }

  function toggleRecipient(id: string) {
    setError(null);
    if (kind === "appointment") {
      setRecipients([id]);
      return;
    }
    setRecipients((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      if (current.length >= MAX_QUOTES) return current;
      return [...current, id];
    });
  }

  function switchKind(next: BookingKind) {
    setKind(next);
    setRecipients((current) => {
      const kept = current.filter((id) => id !== FIRST);
      return next === "appointment" ? kept.slice(0, 1) : kept;
    });
  }

  function toggleItem(key: string) {
    if (key === primaryKey) return;
    setItems((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function submit() {
    setError(null);
    const chosenSlots: BookingSlot[] = slots.filter((s) => s.date).map((s) => ({ date: s.date, period: s.period }));
    startTransition(async () => {
      const result = await submitBookingRequest({
        placeId,
        kind,
        trade,
        firstAvailable: kind === "appointment" && recipients.includes(FIRST),
        phone,
        comment,
        slots: chosenSlots,
        details,
        items: options
          .filter((o) => items.has(`${o.applianceId}:${o.maintenanceTaskId}`))
          .map((o) => ({ applianceId: o.applianceId, maintenanceTaskId: o.maintenanceTaskId, taskTitle: o.taskTitle, applianceLabel: o.applianceLabel })),
        recipients: recipients
          .filter((id) => id !== FIRST)
          .map((id) =>
            id === KNOWN ? { providerName: knownProvider!.name, providerContact: knownProvider!.contact } : { professionalId: id }
          ),
        consent,
        streetAddress: addressMissing ? street : undefined,
        addressComplement: addressMissing ? complement : undefined,
      });
      if (result?.error) setError(result.error);
    });
  }

  const recipientInput = kind === "appointment" ? "radio" : "checkbox";
  const minDate = todayIso();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-5"
    >
      <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(
          [
            ["appointment", "Prendre rendez-vous", "Votre demande part à un seul professionnel."],
            ["quote", "Demander un devis", "Jusqu'à trois professionnels vous répondent avec un prix et une date."],
          ] as const
        ).map(([value, label, help]) => (
          <label
            key={value}
            className={`flex cursor-pointer flex-col gap-1 rounded-2xl border-[1.5px] p-3.5 ${kind === value ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}
          >
            <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => switchKind(value)} />
              {label}
            </span>
            <span className="text-[13px] text-ink-2">{help}</span>
          </label>
        ))}
      </fieldset>

      <section className={CARD_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>{kind === "appointment" ? "Quel professionnel ?" : "Quels professionnels ? (trois au plus)"}</h2>
        <ul className="flex flex-col gap-2">
          {knownProvider && (
            <li>
              <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm text-ink">
                <span className="flex items-center gap-2">
                  <input type={recipientInput} name="recipient" checked={recipients.includes(KNOWN)} onChange={() => toggleRecipient(KNOWN)} />
                  <span>
                    <span className="font-semibold">{knownProvider.name}</span>
                    <span className="block text-[13px] text-ink-2">Votre prestataire habituel</span>
                  </span>
                </span>
              </label>
            </li>
          )}
          {professionals.map((pro) => (
            <li key={pro.id}>
              <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm text-ink">
                <span className="flex items-center gap-2">
                  <input type={recipientInput} name="recipient" checked={recipients.includes(pro.id)} onChange={() => toggleRecipient(pro.id)} />
                  <span>
                    <span className="font-semibold">{pro.name}</span>
                    {pro.city && <span className="block text-[13px] text-ink-2">{pro.city}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-medium text-ink-2">{priceLabel(pro)}</span>
              </label>
            </li>
          ))}
          {kind === "appointment" && (
            <li>
              <label className="flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-sm text-ink">
                <input type="radio" name="recipient" checked={recipients.includes(FIRST)} onChange={() => toggleRecipient(FIRST)} />
                <span>
                  <span className="font-semibold">Le premier disponible</span>
                  <span className="block text-[13px] text-ink-2">Electro Care choisit pour vous un professionnel de votre secteur.</span>
                </span>
              </label>
            </li>
          )}
        </ul>
      </section>

      {options.length > 1 && (
        <section className={CARD_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Une seule visite ?</h2>
          <p className="text-sm text-ink-2">Ajoutez d&apos;autres obligations de ce lieu que le même professionnel peut traiter.</p>
          <ul className="flex flex-col gap-2">
            {options.map((o) => {
              const key = `${o.applianceId}:${o.maintenanceTaskId}`;
              return (
                <li key={key}>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={items.has(key)} disabled={key === primaryKey} onChange={() => toggleItem(key)} />
                    <span>
                      {o.taskTitle} <span className="text-ink-2">· {o.applianceLabel}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className={CARD_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Votre appareil</h2>
        <DetailField label="Marque" value={details.brand} onChange={(v) => setDetails({ ...details, brand: v })} />
        <DetailField label="Modèle" value={details.model} onChange={(v) => setDetails({ ...details, model: v })} />
        <DetailField label="Année" value={details.year} onChange={(v) => setDetails({ ...details, year: v })} type="number" />
        <DetailField label="Dernier entretien (mois)" value={details.lastService} onChange={(v) => setDetails({ ...details, lastService: v })} type="month" />
        {trade === "chauffagiste" && (
          <DetailField label="Énergie" value={details.fuel} onChange={(v) => setDetails({ ...details, fuel: v })} options={FUEL_OPTIONS} />
        )}
        {trade === "ramoneur" && (
          <>
            <DetailField label="Type d'appareil" value={details.applianceKind} onChange={(v) => setDetails({ ...details, applianceKind: v })} options={KIND_OPTIONS} />
            <DetailField label="Nombre de conduits" value={details.flueCount} onChange={(v) => setDetails({ ...details, flueCount: v })} type="number" />
          </>
        )}
      </section>

      <section className={CARD_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Vos disponibilités</h2>
        <p className="text-sm text-ink-2">Deux ou trois demi-journées qui vous conviennent.</p>
        {slots.map((slot, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              min={minDate}
              value={slot.date}
              onChange={(e) => setSlots(slots.map((s, i) => (i === index ? { ...s, date: e.target.value } : s)))}
              className={`${INPUT_CLASS} flex-1`}
              aria-label={`Demi-journée ${index + 1}`}
            />
            <select
              value={slot.period}
              onChange={(e) => setSlots(slots.map((s, i) => (i === index ? { ...s, period: e.target.value as SlotPeriod } : s)))}
              className={INPUT_CLASS}
            >
              <option value="morning">Matin</option>
              <option value="afternoon">Après-midi</option>
            </select>
            {index === 2 && <span className="text-[13px] text-ink-2">facultatif</span>}
          </div>
        ))}
      </section>

      <section className={CARD_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Vos coordonnées</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className="text-sm font-medium text-ink">
            Téléphone
          </label>
          <input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT_CLASS} autoComplete="tel" />
        </div>
        {addressMissing ? (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="street" className="text-sm font-medium text-ink">
                Adresse du lieu
              </label>
              <input id="street" type="text" required value={street} onChange={(e) => setStreet(e.target.value)} className={INPUT_CLASS} autoComplete="street-address" />
              <p className="text-[13px] text-ink-2">Elle sera enregistrée sur ce lieu pour vos prochaines demandes.</p>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="complement" className="text-sm font-medium text-ink">
                Complément d&apos;adresse (facultatif)
              </label>
              <input id="complement" type="text" value={complement} onChange={(e) => setComplement(e.target.value)} className={INPUT_CLASS} />
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-2">Adresse : {placeAddress}</p>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="comment" className="text-sm font-medium text-ink">
            Commentaire (facultatif)
          </label>
          <textarea id="comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} className={INPUT_CLASS} />
        </div>
      </section>

      <label className="flex items-start gap-2.5 rounded-2xl bg-surface p-3.5 text-sm text-ink">
        <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>{CONSENT_TEXT}</span>
      </label>

      {error && <p className="text-sm text-late">{error}</p>}
      <button type="submit" disabled={isPending} className={`${BUTTON_PRIMARY} self-start`}>
        {isPending ? "Envoi…" : kind === "appointment" ? "Envoyer la demande de rendez-vous" : "Envoyer la demande de devis"}
      </button>
    </form>
  );
}
