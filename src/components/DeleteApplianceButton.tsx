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
      className="inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold text-late transition-colors hover:bg-late-soft disabled:opacity-50"
      aria-label="Supprimer l'appareil"
    >
      {isPending ? "…" : "Supprimer"}
    </button>
  );
}
