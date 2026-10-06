"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: name || email })
        : await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message ?? "Une erreur est survenue. Réessayez.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mode === "sign-up" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium text-ink">
            Nom
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>
      )}
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
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
        />
      </div>
      {error && <p className="text-sm text-late">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:opacity-85 disabled:opacity-60"
      >
        {submitting ? "Un instant…" : mode === "sign-up" ? "Créer mon compte" : "Se connecter"}
      </button>
    </form>
  );
}
