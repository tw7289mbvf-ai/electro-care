import { notFound, redirect } from "next/navigation";
import { getPlace } from "@/lib/places";
import { getAppliances } from "@/lib/appliances";
import { QuestionnaireWizard } from "@/components/QuestionnaireWizard";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function QuestionnairePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }
  const place = await getPlace(id);
  if (!place) {
    notFound();
  }
  // Already onboarded: no resume mechanism exists, so re-entering would restart at Q01
  // and could duplicate effects. Send back to the place's own view instead.
  if (place.onboardedAt) {
    redirect("/");
  }

  const appliances = await getAppliances();
  const existingEquipmentTypeIds = appliances
    .filter((a) => a.placeId === place.id && a.equipmentTypeId)
    .map((a) => a.equipmentTypeId as string);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {place.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Quelques questions pour préparer les obligations et rappels de ce lieu.
          </p>
        </header>

        <QuestionnaireWizard
          placeId={place.id}
          existingEquipmentTypeIds={existingEquipmentTypeIds}
          existingPropertyType={place.propertyType}
        />
      </main>
    </div>
  );
}
