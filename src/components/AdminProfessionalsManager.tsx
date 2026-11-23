"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PROFESSIONAL_STATUS_LABELS, type AdminProfessional, type AdminProfessionalInput, type ProfessionalStatus } from "@/lib/booking-admin";
import { BOOKING_TRADES, BOOKING_TRADE_LABELS, type BookingTrade } from "@/lib/maintenance-tasks";
import { BOOKING_TASKS_BY_TRADE } from "@/lib/booking-tasks";
import { BUTTON_NEUTRAL, BUTTON_PRIMARY, INPUT_CLASS } from "@/components/ui";

const INPUT_SMALL = `${INPUT_CLASS} text-sm`;

function emptyInput(): AdminProfessionalInput {
  return {
    id: null,
    name: "",
    trades: [],
    streetAddress: null,
    postalCode: null,
    city: null,
    phone: null,
    email: null,
    website: null,
    postalCodesCovered: [],
    status: "non_contacte",
    active: true,
    googleRating: null,
    googleReviewCount: null,
    googleCheckedOn: null,
    notes: "",
    prices: {},
  };
}

async function postAdmin(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; id?: string; url?: string }> {
  const res = await fetch("/admin/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as { error?: string; id?: string; url?: string } | null;
  if (!res.ok) return { ok: false, error: json?.error ?? "Une erreur est survenue." };
  return { ok: true, ...json };
}

// Create or edit one professional (spec "Professionals directory"): identity, trades,
// postcodes covered, status, Google rating at entry, free notes, one optional price per
// bookable task of its trades.
function ProfessionalForm({ initial, onDone }: { initial: AdminProfessionalInput; onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<AdminProfessionalInput>(initial);
  const [codes, setCodes] = useState(initial.postalCodesCovered.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof AdminProfessionalInput>(key: K, value: AdminProfessionalInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const text = (value: string): string | null => (value.trim() === "" ? null : value);
  const priceTasks = form.trades.flatMap((t) => BOOKING_TASKS_BY_TRADE[t]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await postAdmin({
        action: "save-professional",
        professional: { ...form, postalCodesCovered: codes.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean) },
      });
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
      className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 text-sm text-ink"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-medium">
          Nom
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={INPUT_SMALL} />
        </label>
        <label className="flex flex-col gap-1 font-medium">
          Statut
          <select value={form.status} onChange={(e) => set("status", e.target.value as ProfessionalStatus)} className={INPUT_SMALL}>
            {(Object.keys(PROFESSIONAL_STATUS_LABELS) as ProfessionalStatus[]).map((s) => (
              <option key={s} value={s}>
                {PROFESSIONAL_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-1 font-medium">Métiers</legend>
        {BOOKING_TRADES.map((trade) => (
          <label key={trade} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={form.trades.includes(trade)}
              onChange={(e) => set("trades", e.target.checked ? [...form.trades, trade] : form.trades.filter((t) => t !== trade))}
            />
            {BOOKING_TRADE_LABELS[trade]}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 font-medium sm:col-span-3">
          Adresse
          <input value={form.streetAddress ?? ""} onChange={(e) => set("streetAddress", text(e.target.value))} className={INPUT_SMALL} />
        </label>
        <label className="flex flex-col gap-1 font-medium">
          Code postal
          <input value={form.postalCode ?? ""} onChange={(e) => set("postalCode", text(e.target.value))} className={INPUT_SMALL} />
        </label>
        <label className="flex flex-col gap-1 font-medium sm:col-span-2">
          Ville
          <input value={form.city ?? ""} onChange={(e) => set("city", text(e.target.value))} className={INPUT_SMALL} />
        </label>
        <label className="flex flex-col gap-1 font-medium">
          Téléphone
          <input value={form.phone ?? ""} onChange={(e) => set("phone", text(e.target.value))} className={INPUT_SMALL} />
        </label>
        <label className="flex flex-col gap-1 font-medium">
          E-mail
          <input type="email" value={form.email ?? ""} onChange={(e) => set("email", text(e.target.value))} className={INPUT_SMALL} />
        </label>
        <label className="flex flex-col gap-1 font-medium">
          Site
          <input value={form.website ?? ""} onChange={(e) => set("website", text(e.target.value))} className={INPUT_SMALL} />
        </label>
      </div>
      <label className="flex flex-col gap-1 font-medium">
        Codes postaux couverts (séparés par des virgules)
        <textarea rows={2} value={codes} onChange={(e) => setCodes(e.target.value)} className={INPUT_SMALL} />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 font-medium">
          Note Google
          <input
            type="number"
            step="0.1"
            min="0"
            max="5"
            value={form.googleRating ?? ""}
            onChange={(e) => set("googleRating", e.target.value === "" ? null : Number(e.target.value))}
            className={INPUT_SMALL}
          />
        </label>
        <label className="flex flex-col gap-1 font-medium">
          Nombre d&apos;avis
          <input
            type="number"
            min="0"
            value={form.googleReviewCount ?? ""}
            onChange={(e) => set("googleReviewCount", e.target.value === "" ? null : Number(e.target.value))}
            className={INPUT_SMALL}
          />
        </label>
        <label className="flex flex-col gap-1 font-medium">
          Relevés le
          <input type="date" value={form.googleCheckedOn ?? ""} onChange={(e) => set("googleCheckedOn", text(e.target.value))} className={INPUT_SMALL} />
        </label>
      </div>
      {priceTasks.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Prix par prestation (euros, facultatif)</legend>
          {priceTasks.map((task) => (
            <label key={task.id} className="flex items-center justify-between gap-3">
              <span className="text-ink-2">
                {task.id} · {task.title}
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.prices[task.id] ?? ""}
                onChange={(e) => set("prices", { ...form.prices, [task.id]: e.target.value === "" ? null : Number(e.target.value) })}
                className={`${INPUT_SMALL} w-28`}
              />
            </label>
          ))}
        </fieldset>
      )}
      <label className="flex flex-col gap-1 font-medium">
        Notes libres
        <textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={INPUT_SMALL} />
      </label>
      <label className="flex items-center gap-2 font-medium">
        <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
        Actif (proposé aux utilisateurs)
      </label>
      {error && <p className="text-late">{error}</p>}
      <div className="flex flex-wrap gap-2">
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

export function AdminProfessionalsManager({ professionals }: { professionals: AdminProfessional[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleActive(pro: AdminProfessional) {
    setError(null);
    startTransition(async () => {
      const result = await postAdmin({ action: "set-professional-active", professionalId: pro.id, active: !pro.active });
      if (!result.ok) setError(result.error ?? null);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {editing === "new" ? (
        <ProfessionalForm initial={emptyInput()} onDone={() => setEditing(null)} />
      ) : (
        <button type="button" onClick={() => setEditing("new")} className={`${BUTTON_PRIMARY} self-start`}>
          Ajouter un professionnel
        </button>
      )}
      {error && <p className="text-sm text-late">{error}</p>}
      <ul className="flex flex-col gap-3">
        {professionals.map((pro) => (
          <li key={pro.id} className="flex flex-col gap-2 rounded-2xl bg-surface p-4 text-sm">
            {editing === pro.id ? (
              <ProfessionalForm initial={{ ...pro, prices: { ...pro.prices } }} onDone={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-ink">
                      {pro.name}
                      {!pro.active && <span className="ml-2 rounded-full bg-neutral-soft px-2 py-0.5 text-[12px] font-medium text-neutral">Inactif</span>}
                    </p>
                    <p className="text-ink-2">
                      {pro.trades.map((t: BookingTrade) => BOOKING_TRADE_LABELS[t]).join(", ")} · {[pro.postalCode, pro.city].filter(Boolean).join(" ")}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[13px] font-medium ${pro.status === "refus" ? "bg-late-soft text-late" : pro.status === "partenaire" ? "bg-ok-soft text-ok" : "bg-surface-2 text-ink-2"}`}>
                    {PROFESSIONAL_STATUS_LABELS[pro.status]}
                  </span>
                </div>
                <p className="text-ink-2">
                  {[pro.phone, pro.email, pro.website].filter(Boolean).join(" · ") || "Aucun contact"}
                  {pro.googleRating !== null && (
                    <>
                      {" "}
                      · Google {pro.googleRating.toLocaleString("fr-FR")} ({pro.googleReviewCount ?? 0} avis{pro.googleCheckedOn ? `, ${pro.googleCheckedOn}` : ""})
                    </>
                  )}
                </p>
                <p className="text-ink-2">
                  {pro.postalCodesCovered.length} code{pro.postalCodesCovered.length > 1 ? "s" : ""} postal{pro.postalCodesCovered.length > 1 ? "aux" : ""} couvert{pro.postalCodesCovered.length > 1 ? "s" : ""}
                  {Object.keys(pro.prices).length > 0 && (
                    <>
                      {" "}
                      · Prix :{" "}
                      {Object.entries(pro.prices)
                        .map(([task, price]) => `${task} ${price} €`)
                        .join(", ")}
                    </>
                  )}
                </p>
                {pro.notes && <p className="text-ink">{pro.notes}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditing(pro.id)} className={BUTTON_NEUTRAL}>
                    Modifier
                  </button>
                  <button type="button" disabled={isPending} onClick={() => toggleActive(pro)} className={BUTTON_NEUTRAL}>
                    {pro.active ? "Désactiver" : "Activer"}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
        {professionals.length === 0 && <li className="text-sm text-ink-2">Aucun professionnel.</li>}
      </ul>
    </div>
  );
}
