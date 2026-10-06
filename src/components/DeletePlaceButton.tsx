"use client";

import { useTransition } from "react";
import { removePlace } from "@/app/actions";

export function DeletePlaceButton({ id, confirmMessage }: { id: string; confirmMessage: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(confirmMessage)) return;
        startTransition(() => removePlace(id));
      }}
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-late-soft px-4 py-2 text-sm font-medium text-late transition-colors hover:bg-late-soft disabled:opacity-50"
    >
      {isPending ? "Suppression…" : "Supprimer ce lieu"}
    </button>
  );
}
