import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function SignUpPage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-14 sm:px-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Créer un compte
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Vos lieux et appareils ne seront visibles que par vous.
          </p>
        </header>
        <AuthForm mode="sign-up" />
        <p className="text-sm text-ink-2">
          Déjà un compte ?{" "}
          <Link href="/auth/sign-in" className="inline-flex min-h-11 items-center font-semibold text-accent">
            Se connecter
          </Link>
        </p>
      </main>
    </div>
  );
}
