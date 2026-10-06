"use client";

import { useState, useTransition } from "react";
import { updateEmailRemindersPreferenceAction } from "@/app/actions";

export function EmailRemindersToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      await updateEmailRemindersPreferenceAction(next);
    });
  }

  return (
    <label className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-[15px] text-ink">Rappels par e-mail</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isPending}
        onClick={handleToggle}
        className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full p-[3px] transition-colors disabled:opacity-50 ${
          enabled ? "bg-accent" : "bg-line-strong"
        }`}
      >
        {/* The knob sits in the track's flow (not absolutely positioned), so the track's
            items-center keeps it vertically centred and its 3px padding gives the same
            margin on every side. Track 48px, knob 22px: on = 48 - 2×3 - 22 = 20px shift. */}
        <span
          aria-hidden="true"
          className={`h-[22px] w-[22px] rounded-full bg-knob transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
