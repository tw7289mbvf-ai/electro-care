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
      className="self-start inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:opacity-85 disabled:opacity-60"
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
      <label htmlFor="message" className="text-sm font-medium text-ink">
        Contacter l&apos;administrateur
      </label>
      <textarea
        id="message"
        name="message"
        required
        rows={3}
        placeholder="Votre message"
        className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
      />
      {state.error && <p className="text-sm text-late">{state.error}</p>}
      {sent && <p className="text-sm text-ok">Message envoyé.</p>}
      <SubmitButton />
    </form>
  );
}
