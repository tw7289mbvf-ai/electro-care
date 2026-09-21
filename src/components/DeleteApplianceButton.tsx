"use client";

import { useTransition } from "react";
import { removeAppliance } from "@/app/actions";

export function DeleteApplianceButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => removeAppliance(id))}
      className="shrink-0 rounded-md px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
      aria-label="Supprimer l'appareil"
    >
      {isPending ? "…" : "Supprimer"}
    </button>
  );
}
