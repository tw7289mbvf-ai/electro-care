"use client";

import { useState, useTransition } from "react";
import { requestAccountDeletion } from "@/app/actions";

export function RequestAccountDeletionButton({ alreadyRequested }: { alreadyRequested: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [requested, setRequested] = useState(alreadyRequested);
  const [error, setError] = useState<string | null>(null);

  if (requested) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Votre compte sera supprimé sous 7 jours.
      </p>
    );
  }

  function handleClick() {
    if (!window.confirm("Demander la suppression de votre compte ? Vous recevrez une confirmation.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await requestAccountDeletion();
        setRequested(true);
      } catch {
        setError("La demande n'a pas pu être envoyée.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="self-start rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        {isPending ? "Envoi…" : "Demander la suppression de mon compte"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
