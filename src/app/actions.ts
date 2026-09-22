"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addAppliance, deleteAppliance } from "@/lib/appliances";
import { addPlace, getPlaces, updatePlace as updatePlaceRecord } from "@/lib/places";
import { CATEGORIES, type Category } from "@/lib/appliance-types";
import { getEquipmentType } from "@/lib/equipment-types";
import { PROPERTY_TYPES, type PropertyType } from "@/lib/place-types";

export type FormState = {
  error?: string;
};

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

function isPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

function optionalTrimmed(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createAppliance(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const placeId = String(formData.get("placeId") ?? "");
  const category = String(formData.get("category") ?? "");
  const name = optionalTrimmed(formData, "name");
  const brand = optionalTrimmed(formData, "brand");
  const model = optionalTrimmed(formData, "model");
  const room = optionalTrimmed(formData, "room");
  const equipmentTypeId = optionalTrimmed(formData, "equipmentTypeId");
  const purchaseDate = optionalTrimmed(formData, "purchaseDate");

  const places = await getPlaces();
  if (!places.some((p) => p.id === placeId)) {
    return { error: "Veuillez choisir un lieu valide." };
  }
  if (!isCategory(category)) {
    return { error: "Veuillez choisir une catégorie valide." };
  }
  if (equipmentTypeId) {
    const type = getEquipmentType(equipmentTypeId);
    if (!type || type.category !== category) {
      return { error: "Le type d'appareil choisi ne correspond pas à la catégorie." };
    }
  }
  if (purchaseDate && Number.isNaN(Date.parse(purchaseDate))) {
    return { error: "Veuillez saisir une date d'achat valide." };
  }

  await addAppliance({ placeId, category, name, brand, model, room, equipmentTypeId, purchaseDate });
  revalidatePath("/");
  return {};
}

export async function removeAppliance(id: string): Promise<void> {
  await deleteAppliance(id);
  revalidatePath("/");
}

export async function createPlace(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = optionalTrimmed(formData, "name");
  const commune = optionalTrimmed(formData, "commune");
  const postcode = optionalTrimmed(formData, "postcode");
  const propertyType = optionalTrimmed(formData, "propertyType");

  if (!name) {
    return { error: "Veuillez saisir un nom pour le lieu." };
  }
  if (propertyType && !isPropertyType(propertyType)) {
    return { error: "Veuillez choisir un type de bien valide." };
  }

  await addPlace({ name, commune, postcode, propertyType: propertyType as PropertyType | null });
  revalidatePath("/");
  return {};
}

export async function updatePlace(
  id: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const name = optionalTrimmed(formData, "name");
  const commune = optionalTrimmed(formData, "commune");
  const postcode = optionalTrimmed(formData, "postcode");
  const propertyType = optionalTrimmed(formData, "propertyType");

  if (!name) {
    return { error: "Veuillez saisir un nom pour le lieu." };
  }
  if (propertyType && !isPropertyType(propertyType)) {
    return { error: "Veuillez choisir un type de bien valide." };
  }

  await updatePlaceRecord(id, { name, commune, postcode, propertyType: propertyType as PropertyType | null });
  revalidatePath("/");
  redirect("/");
}
