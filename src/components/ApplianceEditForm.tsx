"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions";
import type { Appliance } from "@/lib/appliance-types";
import { BUTTON_PRIMARY, INPUT_CLASS } from "@/components/ui";

const initialState: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${BUTTON_PRIMARY} w-full sm:w-auto`}
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
      className="grid grid-cols-1 gap-4 rounded-[18px] bg-surface p-4 sm:grid-cols-2 sm:p-5"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="brand" className="text-sm font-medium text-ink">
          Marque <span className="font-normal text-ink-2">(facultatif)</span>
        </label>
        <input
          id="brand"
          name="brand"
          type="text"
          defaultValue={appliance.brand ?? ""}
          className={INPUT_CLASS}
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
          defaultValue={appliance.model ?? ""}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="powerKw" className="text-sm font-medium text-ink">
          Puissance (kW) <span className="font-normal text-ink-2">(facultatif)</span>
        </label>
        <input
          id="powerKw"
          name="powerKw"
          type="number"
          step="0.1"
          min="0"
          defaultValue={appliance.powerKw ?? ""}
          className={INPUT_CLASS}
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
          defaultValue={appliance.purchaseDate ?? ""}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="warrantyEnd" className="text-sm font-medium text-ink">
          Fin de garantie <span className="font-normal text-ink-2">(facultatif)</span>
        </label>
        <input
          id="warrantyEnd"
          name="warrantyEnd"
          type="date"
          defaultValue={appliance.warrantyEnd ?? ""}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="room" className="text-sm font-medium text-ink">
          Pièce <span className="font-normal text-ink-2">(facultatif)</span>
        </label>
        <input
          id="room"
          name="room"
          type="text"
          defaultValue={appliance.room ?? ""}
          className={INPUT_CLASS}
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
