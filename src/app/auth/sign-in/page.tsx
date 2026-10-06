import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function SignInPage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-14 sm:px-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Connexion</h1>
          <p className="mt-1 text-sm text-ink-2">
            Accédez à vos lieux et à vos appareils.
          </p>
        </header>
        <AuthForm mode="sign-in" />
        <p className="text-sm text-ink-2">
          Pas encore de compte ?{" "}
          <Link href="/auth/sign-up" className="inline-flex min-h-11 items-center font-semibold text-accent">
            Créer un compte
          </Link>
        </p>
      </main>
    </div>
  );
}
