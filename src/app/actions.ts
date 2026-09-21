"use server";

import { revalidatePath } from "next/cache";
import { addAppliance, deleteAppliance } from "@/lib/appliances";
import { CATEGORIES, type Category } from "@/lib/appliance-types";

export type FormState = {
  error?: string;
};

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export async function createAppliance(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const purchaseDate = String(formData.get("purchaseDate") ?? "");

  if (!name) {
    return { error: "Veuillez saisir un nom pour l'appareil." };
  }
  if (!brand) {
    return { error: "Veuillez saisir une marque." };
  }
  if (!model) {
    return { error: "Veuillez saisir un modèle." };
  }
  if (!isCategory(category)) {
    return { error: "Veuillez choisir une catégorie valide." };
  }
  if (!purchaseDate || Number.isNaN(Date.parse(purchaseDate))) {
    return { error: "Veuillez saisir une date d'achat valide." };
  }

  await addAppliance({ name, brand, model, category, purchaseDate });
  revalidatePath("/");
  return {};
}

export async function removeAppliance(id: string): Promise<void> {
  await deleteAppliance(id);
  revalidatePath("/");
}
