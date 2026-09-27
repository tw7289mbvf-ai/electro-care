"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { submitContactMessage } from "@/app/actions";
import type { FormState } from "@/app/actions";

const initialState: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
    >
      {pending ? "Envoi…" : "Envoyer"}
    </button>
  );
}

export function ContactAdminForm() {
  const [state, formAction] = useActionState(submitContactMessage, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const sent = state !== initialState && !state.error;

  useEffect(() => {
    if (sent) formRef.current?.reset();
  }, [sent]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <label htmlFor="message" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Contacter l&apos;administrateur
      </label>
      <textarea
        id="message"
        name="message"
        required
        rows={3}
        placeholder="Votre message"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {sent && <p className="text-sm text-emerald-600 dark:text-emerald-400">Message envoyé.</p>}
      <SubmitButton />
    </form>
  );
}
