"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { removeAppliance } from "@/app/actions";

export function DeleteApplianceButton({
  id,
  confirmMessage,
  redirectTo,
}: {
  id: string;
  confirmMessage?: string;
  redirectTo?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    startTransition(async () => {
      await removeAppliance(id);
      if (redirectTo) router.push(redirectTo);
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className="shrink-0 rounded-md px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
      aria-label="Supprimer l'appareil"
    >
      {isPending ? "…" : "Supprimer"}
    </button>
  );
}
