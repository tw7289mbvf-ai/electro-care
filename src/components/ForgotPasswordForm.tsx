"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

// Always shows the same confirmation, whatever the server answers: telling "no account"
// apart from "email sent" would let anyone probe which addresses have an account.
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await authClient
      .requestPasswordReset({ email, redirectTo: `${window.location.origin}/auth/reset-password` })
      .catch(() => null);
    setSubmitting(false);
    setSent(true);
  }

  if (sent) {
    return (
      <p role="status" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
        Si un compte existe avec cette adresse, un e-mail vient d&apos;être envoyé. Suivez le lien
        qu&apos;il contient pour choisir un nouveau mot de passe.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-ink">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:opacity-85 disabled:opacity-60"
      >
        {submitting ? "Un instant…" : "Recevoir le lien"}
      </button>
    </form>
  );
}
