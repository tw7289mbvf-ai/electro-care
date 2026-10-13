import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-14 sm:px-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Mot de passe oublié</h1>
          <p className="mt-1 text-sm text-ink-2">
            Indiquez l&apos;adresse de votre compte : nous vous enverrons un lien pour choisir un
            nouveau mot de passe.
          </p>
        </header>
        <ForgotPasswordForm />
        <p className="text-sm text-ink-2">
          <Link href="/auth/sign-in" className="inline-flex min-h-11 items-center font-semibold text-accent">
            Retour à la connexion
          </Link>
        </p>
      </main>
    </div>
  );
}
