"use client";

import { useState, useTransition } from "react";
import { logMultiHomeInterestAction } from "@/app/actions";

export function MultiHomeInterestButton({ alreadyClicked }: { alreadyClicked: boolean }) {
  const [clicked, setClicked] = useState(alreadyClicked);
  const [isPending, startTransition] = useTransition();

  if (clicked) {
    return <p className="text-sm text-ink-2">Merci, nous vous tiendrons informé.</p>;
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
      className="self-start inline-flex min-h-11 items-center justify-center rounded-xl border-[1.5px] border-line-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
    >
      Ça m&apos;intéresse
    </button>
  );
}
