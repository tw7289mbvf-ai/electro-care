"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { submitFeedbackMessage } from "@/app/actions";
import type { FormState } from "@/app/actions";

const initialState: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:opacity-85 disabled:opacity-60"
    >
      {pending ? "Envoi…" : "Envoyer"}
    </button>
  );
}

export function FeedbackLink() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(submitFeedbackMessage, initialState);
  const sent = state !== initialState && !state.error;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center hover:underline"
      >
        Donner mon avis
      </button>
    );
  }

  if (sent) {
    return <p className="inline-flex min-h-11 items-center text-ok">Merci, c&apos;est bien reçu.</p>;
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      <input type="hidden" name="page" value={pathname} />
      <label htmlFor="feedback-message" className="font-medium text-ink">
        Donner mon avis
      </label>
      <textarea
        id="feedback-message"
        name="message"
        required
        rows={3}
        placeholder="Votre avis"
        className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
      />
      {state.error && <p className="text-late">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
