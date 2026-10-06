"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleClick() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-medium text-ink-2 hover:text-ink"
    >
      Se déconnecter
    </button>
  );
}
