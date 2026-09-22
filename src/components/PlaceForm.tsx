"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS, type Place } from "@/lib/place-types";

const initialState: FormState = {};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function PlaceForm({
  place,
  action,
  submitLabel,
  pendingLabel,
  resetOnSuccess = false,
}: {
  place?: Place;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.error && resetOnSuccess) {
      formRef.current?.reset();
    }
  }, [state, resetOnSuccess]);

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
          defaultValue={place?.name}
          placeholder="ex. Maison principale"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="commune" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Commune
        </label>
        <input
          id="commune"
          name="commune"
          type="text"
          defaultValue={place?.commune ?? ""}
          placeholder="ex. Lyon"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="postcode" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Code postal
        </label>
        <input
          id="postcode"
          name="postcode"
          type="text"
          defaultValue={place?.postcode ?? ""}
          placeholder="ex. 69001"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="propertyType" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Type de bien
        </label>
        <select
          id="propertyType"
          name="propertyType"
          defaultValue={place?.propertyType ?? ""}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="">Non renseigné</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {PROPERTY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 sm:col-span-2 dark:text-red-400">{state.error}</p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
      </div>
    </form>
  );
}
