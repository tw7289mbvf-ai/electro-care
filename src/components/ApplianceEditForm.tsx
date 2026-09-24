"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions";
import type { Appliance } from "@/lib/appliance-types";

const initialState: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {pending ? "Enregistrement…" : "Enregistrer"}
    </button>
  );
}

export function ApplianceEditForm({
  appliance,
  action,
}: {
  appliance: Appliance;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="brand" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Marque <span className="font-normal text-zinc-400">(facultatif)</span>
        </label>
        <input
          id="brand"
          name="brand"
          type="text"
          defaultValue={appliance.brand ?? ""}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="model" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Modèle <span className="font-normal text-zinc-400">(facultatif)</span>
        </label>
        <input
          id="model"
          name="model"
          type="text"
          defaultValue={appliance.model ?? ""}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="powerKw" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Puissance (kW) <span className="font-normal text-zinc-400">(facultatif)</span>
        </label>
        <input
          id="powerKw"
          name="powerKw"
          type="number"
          step="0.1"
          min="0"
          defaultValue={appliance.powerKw ?? ""}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="purchaseDate" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Date d&apos;achat <span className="font-normal text-zinc-400">(facultatif)</span>
        </label>
        <input
          id="purchaseDate"
          name="purchaseDate"
          type="date"
          max={new Date().toISOString().split("T")[0]}
          defaultValue={appliance.purchaseDate ?? ""}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="room" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Pièce <span className="font-normal text-zinc-400">(facultatif)</span>
        </label>
        <input
          id="room"
          name="room"
          type="text"
          defaultValue={appliance.room ?? ""}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600 sm:col-span-2 dark:text-red-400">{state.error}</p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}
