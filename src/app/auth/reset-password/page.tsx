import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

// Opened from the reset email: Neon Auth checks the link, then redirects here with
// ?token=… when it is valid, or ?error=INVALID_TOKEN when it has expired or was used.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-14 sm:px-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Nouveau mot de passe</h1>
        </header>
        {token && !error ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
            Ce lien a expiré ou a déjà servi.{" "}
            <Link href="/auth/forgot-password" className="font-semibold text-accent">
              Demander un nouveau lien
            </Link>
          </p>
        )}
        <p className="text-sm text-ink-2">
          <Link href="/auth/sign-in" className="inline-flex min-h-11 items-center font-semibold text-accent">
            Retour à la connexion
          </Link>
        </p>
      </main>
    </div>
  );
}
