"use client";

import { useState, useTransition } from "react";
import { bookObligationAppointment, cancelObligationAppointment, markObligationDone } from "@/app/actions";
import { MonthYearFields, monthYearToIso } from "@/components/MonthYearFields";
import { pastYearOptions, formatFrenchDate } from "@/lib/french-dates";
import { BUTTON_CLASS, GHOST_BUTTON_CLASS, INPUT_CLASS, WINDOW_CLASS, TEXT_BUTTON_CLASS } from "@/components/inline-form-styles";
import type { ObligationAppointment } from "@/lib/obligation-appointments";
import { getTodayInFrance, type ObligationStatus } from "@/lib/obligations";
import { Icon } from "@/components/ui";

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthOf(isoDate: string): { month: string; year: string } {
  const [year, month] = isoDate.split("-");
  return { month, year };
}

// "Rendez-vous pris" booking/reschedule form (spec's "Managing Appliances"): a future
// date to the day (not month/year like every other date here) and a provider.
function BookingForm({
  applianceId,
  maintenanceTaskId,
  initialProviderName = "",
  onDone,
  onCancel,
}: {
  applianceId: string;
  maintenanceTaskId: string;
  initialProviderName?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState("");
  const [providerName, setProviderName] = useState(initialProviderName);
  const [providerContact, setProviderContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await bookObligationAppointment(applianceId, maintenanceTaskId, date, providerName, providerContact);
          if (result.error) {
            setError(result.error);
            return;
          }
          onDone();
        });
      }}
      className={WINDOW_CLASS}
    >
      <input type="date" min={tomorrowIso()} value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLASS} />
      <input
        type="text"
        value={providerName}
        onChange={(e) => setProviderName(e.target.value)}
        placeholder="Prestataire"
        className={INPUT_CLASS}
      />
      <input
        type="text"
        value={providerContact}
        onChange={(e) => setProviderContact(e.target.value)}
        placeholder="E-mail ou téléphone du prestataire (facultatif)"
        className={INPUT_CLASS}
      />
      {error && <p className="text-late">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={isPending || !date || !providerName.trim()} className={BUTTON_CLASS}>
          {isPending ? "…" : "Valider"}
        </button>
        <button type="button" onClick={onCancel} className={TEXT_BUTTON_CLASS}>
          Annuler
        </button>
      </div>
    </form>
  );
}

// "Le rendez-vous a-t-il eu lieu ? Oui" (spec's "Managing Appliances"): opens "C'est
// fait" prefilled with the appointment's month and provider.
function PrefilledCompletionForm({
  applianceId,
  maintenanceTaskId,
  appointment,
  onDone,
  onCancel,
}: {
  applianceId: string;
  maintenanceTaskId: string;
  appointment: ObligationAppointment;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(monthOf(appointment.appointmentDate));
  const [providerName, setProviderName] = useState(appointment.providerName);
  const [providerContact, setProviderContact] = useState(appointment.providerContact ?? "");
  const [isPending, startTransition] = useTransition();
  const iso = monthYearToIso(value);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!iso) return;
        startTransition(async () => {
          await markObligationDone(applianceId, maintenanceTaskId, iso.slice(0, 7), providerName, providerContact);
          onDone();
        });
      }}
      className={WINDOW_CLASS}
    >
      <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} small disableFutureMonths />
      <input
        type="text"
        value={providerName}
        onChange={(e) => setProviderName(e.target.value)}
        placeholder="Prestataire (facultatif)"
        className={INPUT_CLASS}
      />
      <input
        type="text"
        value={providerContact}
        onChange={(e) => setProviderContact(e.target.value)}
        placeholder="E-mail ou téléphone du prestataire (facultatif)"
        className={INPUT_CLASS}
      />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={isPending || !iso} className={BUTTON_CLASS}>
          {isPending ? "…" : "Valider"}
        </button>
        <button type="button" onClick={onCancel} className={TEXT_BUTTON_CLASS}>
          Annuler
        </button>
      </div>
    </form>
  );
}

// Spec's "Managing Appliances": "Rendez-vous pris" on a red or orange obligation, the
// blue badge it produces, and the "a-t-il eu lieu ?" flow once the date has passed.
export function AppointmentButton({
  applianceId,
  maintenanceTaskId,
  status,
  appointment,
}: {
  applianceId: string;
  maintenanceTaskId: string;
  status: ObligationStatus;
  appointment: ObligationAppointment | null;
}) {
  const [mode, setMode] = useState<"idle" | "book" | "confirm" | "complete" | "reschedule">("idle");
  const [isPending, startTransition] = useTransition();

  if (!appointment) {
    if (status !== "overdue" && status !== "to_confirm") return null;
    if (mode === "book") {
      return (
        <BookingForm
          applianceId={applianceId}
          maintenanceTaskId={maintenanceTaskId}
          onDone={() => setMode("idle")}
          onCancel={() => setMode("idle")}
        />
      );
    }
    return (
      <button type="button" onClick={() => setMode("book")} className={GHOST_BUTTON_CLASS}>
        Rendez-vous pris
      </button>
    );
  }

  const isPast = appointment.appointmentDate <= getTodayInFrance();
  const badge = (
    <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent">
      <Icon name="appointment" size={16} />
      Rendez-vous le {formatFrenchDate(appointment.appointmentDate)}
      {appointment.providerName ? ` avec ${appointment.providerName}` : ""}
    </span>
  );

  if (mode === "complete") {
    return (
      <PrefilledCompletionForm
        applianceId={applianceId}
        maintenanceTaskId={maintenanceTaskId}
        appointment={appointment}
        onDone={() => setMode("idle")}
        onCancel={() => setMode("idle")}
      />
    );
  }

  if (mode === "reschedule") {
    return (
      <BookingForm
        applianceId={applianceId}
        maintenanceTaskId={maintenanceTaskId}
        initialProviderName={appointment.providerName}
        onDone={() => setMode("idle")}
        onCancel={() => setMode("idle")}
      />
    );
  }

  if (isPast && mode === "confirm") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {badge}
        <span className="text-sm text-ink-2">
          Le rendez-vous du {formatFrenchDate(appointment.appointmentDate)} a-t-il eu lieu ?
        </span>
        <button type="button" onClick={() => setMode("complete")} className={BUTTON_CLASS}>
          Oui
        </button>
        <button type="button" onClick={() => setMode("reschedule")} className={GHOST_BUTTON_CLASS}>
          Reprogrammer
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(async () => cancelObligationAppointment(applianceId, maintenanceTaskId))}
          className={GHOST_BUTTON_CLASS}
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badge}
      {isPast ? (
        <button type="button" onClick={() => setMode("confirm")} className={GHOST_BUTTON_CLASS}>
          Le rendez-vous a-t-il eu lieu ?
        </button>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(async () => cancelObligationAppointment(applianceId, maintenanceTaskId))}
          className={TEXT_BUTTON_CLASS}
        >
          Annuler le rendez-vous
        </button>
      )}
    </div>
  );
}
