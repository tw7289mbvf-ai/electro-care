import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-14 sm:px-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Connexion</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Accédez à vos lieux et à vos appareils.
          </p>
        </header>
        <AuthForm mode="sign-in" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pas encore de compte ?{" "}
          <Link href="/auth/sign-up" className="font-medium text-emerald-700 dark:text-emerald-400">
            Créer un compte
          </Link>
        </p>
      </main>
    </div>
  );
}
