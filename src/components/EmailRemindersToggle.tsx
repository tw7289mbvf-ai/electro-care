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
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-zinc-700 dark:text-zinc-300">Rappels par e-mail</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isPending}
        onClick={handleToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          enabled ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        {/* Anchored with left-0.5: an absolute child's default position inside a
            <button> follows the button's own content centering. Track 44px, knob 20px:
            2px margin on every side, off (left 2px) and on (2 + 20 = 22px, 2px right). */}
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
