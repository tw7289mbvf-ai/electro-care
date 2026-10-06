"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createAppliance, type FormState } from "@/app/actions";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/appliance-types";
import type { EquipmentType } from "@/lib/equipment-types";
import type { Place } from "@/lib/place-types";

const initialState: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 font-semibold text-on-accent transition-colors hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {pending ? "Ajout…" : "Ajouter l'appareil"}
    </button>
  );
}

export function ApplianceForm({
  places,
  equipmentTypes: allEquipmentTypes,
  defaultPlaceId,
}: {
  places: Place[];
  equipmentTypes: Pick<EquipmentType, "id" | "category" | "label">[];
  defaultPlaceId?: string;
}) {
  const [state, formAction] = useActionState(createAppliance, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<Category | "">("");
  const equipmentTypes = category
    ? allEquipmentTypes.filter((t) => t.category === category).sort((a, b) => a.label.localeCompare(b.label, "fr"))
    : [];

  // Reset the dependent "type d'appareil" select when a submission just succeeded.
  // Adjusted during render (React's pattern for this), not in an effect, so it
  // doesn't trigger an extra commit.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (!state.error) {
      setCategory("");
    }
  }

  useEffect(() => {
    if (!state.error) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid grid-cols-1 gap-4 rounded-[20px] bg-surface p-5 sm:grid-cols-2 sm:p-6"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="placeId" className="text-sm font-medium text-ink">
          Lieu
        </label>
        <select
          id="placeId"
          name="placeId"
          required
          defaultValue={defaultPlaceId ?? places[0]?.id}
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        >
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-sm font-medium text-ink">
          Catégorie
        </label>
        <select
          id="category"
          name="category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        >
          <option value="" disabled>
            Choisir une catégorie
          </option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="equipmentTypeId" className="text-sm font-medium text-ink">
          Type d&apos;appareil <span className="font-normal text-ink-2">(facultatif)</span>
        </label>
        <select
          id="equipmentTypeId"
          name="equipmentTypeId"
          disabled={!category}
          defaultValue=""
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
        >
          <option value="">
            {category ? "Non précisé" : "Choisissez d'abord une catégorie"}
          </option>
          {equipmentTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="name" className="text-sm font-medium text-ink">
          Nom <span className="font-normal text-ink-2">(facultatif)</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="ex. Réfrigérateur cuisine"
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="brand" className="text-sm font-medium text-ink">
          Marque <span className="font-normal text-ink-2">(facultatif)</span>
        </label>
        <input
          id="brand"
          name="brand"
          type="text"
          placeholder="ex. Bosch"
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="model" className="text-sm font-medium text-ink">
          Modèle <span className="font-normal text-ink-2">(facultatif)</span>
        </label>
        <input
          id="model"
          name="model"
          type="text"
          placeholder="ex. Serie 6"
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="room" className="text-sm font-medium text-ink">
          Pièce <span className="font-normal text-ink-2">(facultatif)</span>
        </label>
        <input
          id="room"
          name="room"
          type="text"
          placeholder="ex. Chambre parent"
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="purchaseDate" className="text-sm font-medium text-ink">
          Date d&apos;achat <span className="font-normal text-ink-2">(facultatif)</span>
        </label>
        <input
          id="purchaseDate"
          name="purchaseDate"
          type="date"
          max={new Date().toISOString().split("T")[0]}
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>

      {state.error && (
        <p className="text-sm text-late sm:col-span-2">{state.error}</p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}
