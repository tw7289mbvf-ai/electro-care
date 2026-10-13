"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setSubmitting(false);
    if (error) {
      setError(
        error.code === "INVALID_TOKEN"
          ? "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau."
          : "Le mot de passe n'a pas pu être changé. Réessayez.",
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
          Votre mot de passe a été changé. Vous pouvez maintenant vous connecter.
        </p>
        <Link
          href="/auth/sign-in"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:opacity-85"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Nouveau mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
        />
        <p className="text-xs text-ink-2">8 caractères minimum.</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirmation" className="text-sm font-medium text-ink">
          Confirmation
        </label>
        <input
          id="confirmation"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
        />
      </div>
      {error && <p className="text-sm text-late">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:opacity-85 disabled:opacity-60"
      >
        {submitting ? "Un instant…" : "Changer mon mot de passe"}
      </button>
    </form>
  );
}
