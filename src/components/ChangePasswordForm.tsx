"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    const { error } = await authClient.changePassword({ currentPassword, newPassword });
    setSubmitting(false);
    if (error) {
      setError(error.message ?? "Une erreur est survenue.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="currentPassword" className="text-sm font-medium text-ink">
          Mot de passe actuel
        </label>
        <input
          id="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="newPassword" className="text-sm font-medium text-ink">
          Nouveau mot de passe
        </label>
        <input
          id="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
        />
      </div>
      {error && <p className="text-sm text-late">{error}</p>}
      {success && <p className="text-sm text-ok">Mot de passe mis à jour.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:opacity-85 disabled:opacity-60"
      >
        {submitting ? "Un instant…" : "Modifier le mot de passe"}
      </button>
    </form>
  );
}
