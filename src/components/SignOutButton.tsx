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
      className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
    >
      Se déconnecter
    </button>
  );
}
