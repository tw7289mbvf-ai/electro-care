"use client";

import { useState, useTransition } from "react";
import { logMultiHomeInterestAction } from "@/app/actions";

export function MultiHomeInterestButton({ alreadyClicked }: { alreadyClicked: boolean }) {
  const [clicked, setClicked] = useState(alreadyClicked);
  const [isPending, startTransition] = useTransition();

  if (clicked) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Merci, nous vous tiendrons informé.</p>;
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await logMultiHomeInterestAction();
          setClicked(true);
        })
      }
      className="self-start rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      Ça m&apos;intéresse
    </button>
  );
}
