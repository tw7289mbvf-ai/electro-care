"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { createAppliance, type FormState } from "@/app/actions";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/appliance-types";

const initialState: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {pending ? "Ajout…" : "Ajouter l'appareil"}
    </button>
  );
}

export function ApplianceForm() {
  const [state, formAction] = useActionState(createAppliance, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.error) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Nom
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="ex. Réfrigérateur cuisine"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="brand" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Marque
        </label>
        <input
          id="brand"
          name="brand"
          type="text"
          required
          placeholder="ex. Bosch"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="model" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Modèle
        </label>
        <input
          id="model"
          name="model"
          type="text"
          required
          placeholder="ex. Serie 6"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Catégorie
        </label>
        <select
          id="category"
          name="category"
          required
          defaultValue=""
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="" disabled>
            Choisir une catégorie
          </option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="purchaseDate" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Date d&apos;achat
        </label>
        <input
          id="purchaseDate"
          name="purchaseDate"
          type="date"
          required
          max={new Date().toISOString().split("T")[0]}
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
