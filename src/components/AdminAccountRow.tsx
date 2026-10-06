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
      <td className="px-4 py-2 text-ink">{account.email}</td>
      <td className="px-4 py-2 text-ink-2">{formattedCreatedAt}</td>
      <td className="px-4 py-2 text-ink-2">{formattedLastSeenAt}</td>
      <td className="px-4 py-2 text-ink-2">{account.placesCount}</td>
      <td className="px-4 py-2 text-ink-2">{account.appliancesCount}</td>
      <td className="px-4 py-2">
        {account.banned ? (
          <span className="rounded-full bg-late-soft px-2 py-0.5 text-[13px] font-medium text-late">
            Suspendu
          </span>
        ) : (
          <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[13px] font-medium text-ok">
            Actif
          </span>
        )}
      </td>
      <td className="px-4 py-2">
        {isSelf ? (
          <span className="text-[13px] text-ink-2">Vous</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(account.banned ? "reactivate" : "suspend")}
              className="inline-flex min-h-11 items-center rounded-xl border border-line-strong px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {account.banned ? "Réactiver" : "Suspendre"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run("reset-link")}
              className="inline-flex min-h-11 items-center rounded-xl border border-line-strong px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              Lien de réinitialisation
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run("delete")}
              className="inline-flex min-h-11 items-center rounded-xl bg-late-soft px-3 text-sm font-medium text-late transition-colors hover:bg-late-soft disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>
        )}
        {error && <p className="mt-1 text-[13px] text-late">{error}</p>}
      </td>
    </tr>
  );
}
