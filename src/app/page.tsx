import { ApplianceForm } from "@/components/ApplianceForm";
import { ApplianceList } from "@/components/ApplianceList";
import { getAppliances } from "@/lib/appliances";

export default async function Home() {
  const appliances = await getAppliances();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Electro Care
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Suivez les appareils de votre maison.
          </p>
        </header>

        <ApplianceForm />

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Vos appareils
          </h2>
          <ApplianceList appliances={appliances} />
        </section>
      </main>
    </div>
  );
}
