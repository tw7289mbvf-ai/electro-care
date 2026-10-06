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
      className="w-full inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 font-semibold text-on-accent transition-colors hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
      className="grid grid-cols-1 gap-4 rounded-[20px] bg-surface p-5 sm:grid-cols-2 sm:p-6"
    >
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="name" className="text-sm font-medium text-ink">
          Nom
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={place?.name}
          placeholder="ex. Maison principale"
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="commune" className="text-sm font-medium text-ink">
          Commune
        </label>
        <input
          id="commune"
          name="commune"
          type="text"
          defaultValue={place?.commune ?? ""}
          placeholder="ex. Lyon"
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="postcode" className="text-sm font-medium text-ink">
          Code postal
        </label>
        <input
          id="postcode"
          name="postcode"
          type="text"
          defaultValue={place?.postcode ?? ""}
          placeholder="ex. 69001"
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="streetAddress" className="text-sm font-medium text-ink">
          Adresse (facultatif)
        </label>
        <input
          id="streetAddress"
          name="streetAddress"
          type="text"
          defaultValue={place?.streetAddress ?? ""}
          placeholder="ex. 12 rue des Lilas"
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="addressComplement" className="text-sm font-medium text-ink">
          Complément d&apos;adresse (facultatif)
        </label>
        <input
          id="addressComplement"
          name="addressComplement"
          type="text"
          defaultValue={place?.addressComplement ?? ""}
          placeholder="ex. Bâtiment B, 3e étage"
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="propertyType" className="text-sm font-medium text-ink">
          Type de bien
        </label>
        <select
          id="propertyType"
          name="propertyType"
          defaultValue={place?.propertyType ?? ""}
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
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
        <p className="text-sm text-late sm:col-span-2">{state.error}</p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
      </div>
    </form>
  );
}
