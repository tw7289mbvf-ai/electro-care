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
      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
    >
      {isPending ? "Suppression…" : "Supprimer ce lieu"}
    </button>
  );
}
