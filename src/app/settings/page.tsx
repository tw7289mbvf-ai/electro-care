import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Paramètres
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{session.user.email}</p>
        </header>

        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Vie privée</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/legal/mentions-legales" className="underline underline-offset-2">
              Mentions légales
            </Link>
            {" · "}
            <Link href="/legal/confidentialite" className="underline underline-offset-2">
              Politique de confidentialité
            </Link>
            {" · "}
            <Link href="/legal/conditions" className="underline underline-offset-2">
              Conditions d&apos;utilisation
            </Link>
          </p>
        </section>

        {/* "Supprimer mon compte" is temporarily hidden: POST /delete-user returns 404
            with a valid session on this Neon Auth instance (verified 2026-09-27), and
            Neon exposes no config to enable it. See DeleteAccountButton.tsx and
            CLAUDE.md for the fallback under discussion — re-enable only once one is
            chosen and actually deletes the account, not just the app's own tables. */}
      </main>
    </div>
  );
}
