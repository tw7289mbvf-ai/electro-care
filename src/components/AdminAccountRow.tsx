"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminAccount } from "@/lib/admin";

type Action = "suspend" | "reactivate" | "delete" | "reset-link";

const CONFIRM_MESSAGES: Partial<Record<Action, (email: string) => string>> = {
  suspend: (email) => `Suspendre « ${email} » ? Ce compte ne pourra plus se connecter.`,
  delete: (email) => `Supprimer « ${email} » ? Tous ses lieux et appareils seront supprimés avec, définitivement.`,
};

export function AdminAccountRow({
  account,
  isSelf,
  formattedCreatedAt,
  formattedLastSeenAt,
}: {
  account: AdminAccount;
  isSelf: boolean;
  formattedCreatedAt: string;
  formattedLastSeenAt: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: Action) {
    const confirmMessage = CONFIRM_MESSAGES[action]?.(account.email);
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, accountId: account.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Une erreur est survenue.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <tr>
      <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">{account.email}</td>
      <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{formattedCreatedAt}</td>
      <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{formattedLastSeenAt}</td>
      <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{account.placesCount}</td>
      <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{account.appliancesCount}</td>
      <td className="px-4 py-2">
        {account.banned ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
            Suspendu
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            Actif
          </span>
        )}
      </td>
      <td className="px-4 py-2">
        {isSelf ? (
          <span className="text-xs text-zinc-400">Vous</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(account.banned ? "reactivate" : "suspend")}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {account.banned ? "Réactiver" : "Suspendre"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run("reset-link")}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Lien de réinitialisation
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run("delete")}
              className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Supprimer
            </button>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </td>
    </tr>
  );
}
