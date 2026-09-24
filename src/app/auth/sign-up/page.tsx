import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-14 sm:px-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Créer un compte
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Vos lieux et appareils ne seront visibles que par vous.
          </p>
        </header>
        <AuthForm mode="sign-up" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Déjà un compte ?{" "}
          <Link href="/auth/sign-in" className="font-medium text-emerald-700 dark:text-emerald-400">
            Se connecter
          </Link>
        </p>
      </main>
    </div>
  );
}
