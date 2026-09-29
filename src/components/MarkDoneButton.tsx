"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { markObligationDone } from "@/app/actions";
import { MonthYearFields, monthYearToIso } from "@/components/MonthYearFields";
import { pastYearOptions } from "@/lib/french-dates";
import type { ObligationStatus } from "@/lib/obligations";

function currentMonthValue() {
  const now = new Date();
  return { month: String(now.getMonth() + 1).padStart(2, "0"), year: String(now.getFullYear()) };
}

// Spec "Actions by status": green shows no button; red (or "à planifier", no data yet)
// shows "C'est fait"; orange shows "Mettre à jour" — a date picker when the obligation
// is missing a date, or a link to the appliance card when it's missing the power/
// threshold that would resolve legalStatus "conditional".
export function MarkDoneButton({
  applianceId,
  maintenanceTaskId,
  status,
  toConfirmReason,
}: {
  applianceId: string;
  maintenanceTaskId: string;
  status: ObligationStatus;
  toConfirmReason: "date" | "threshold" | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentMonthValue);
  const [providerName, setProviderName] = useState("");
  const [providerContact, setProviderContact] = useState("");
  const [showUploadNotice, setShowUploadNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  if (status === "up_to_date") return null;

  const isToConfirm = status === "to_confirm";
  const label = isToConfirm ? "Mettre à jour" : "C'est fait";
  const closedButtonClass = isToConfirm
    ? "shrink-0 rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100 dark:bg-orange-950/50 dark:text-orange-300 dark:hover:bg-orange-950"
    : "shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950";

  if (isToConfirm && toConfirmReason === "threshold") {
    return (
      <Link href={`/appliances/${applianceId}`} className={closedButtonClass}>
        {label}
      </Link>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={closedButtonClass}>
        {label}
      </button>
    );
  }

  const iso = monthYearToIso(value);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!iso) return;
        startTransition(async () => {
          await markObligationDone(applianceId, maintenanceTaskId, iso.slice(0, 7), providerName, providerContact);
          setOpen(false);
        });
      }}
      className="flex w-full flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
    >
      <MonthYearFields value={value} onChange={setValue} years={pastYearOptions()} small />
      <input
        type="text"
        value={providerName}
        onChange={(e) => setProviderName(e.target.value)}
        placeholder="Prestataire (facultatif)"
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
      <input
        type="text"
        value={providerContact}
        onChange={(e) => setProviderContact(e.target.value)}
        placeholder="E-mail ou téléphone du prestataire (facultatif)"
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
      <div className="flex flex-col gap-1">
        {/* Mock: opens the file picker, but nothing is ever read from or sent with this
            input (no name attribute, value never inspected) — document storage doesn't
            exist yet (spec's "Managing Appliances"). */}
        <input ref={fileInputRef} type="file" className="hidden" tabIndex={-1} aria-hidden="true" />
        <button
          type="button"
          onClick={() => {
            fileInputRef.current?.click();
            setShowUploadNotice(true);
          }}
          className="self-start text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Ajouter l&apos;attestation
        </button>
        {showUploadNotice && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Le dépôt des documents arrive bientôt.</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending || !iso}
          className="rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {isPending ? "…" : "Valider"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
