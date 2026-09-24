"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addAppliance, deleteAppliance, updateAppliance as updateApplianceRecord } from "@/lib/appliances";
import { addPlace, deletePlace, getPlaces, markPlaceOnboarded, updatePlace as updatePlaceRecord } from "@/lib/places";
import { setApplianceObligation } from "@/lib/appliance-obligations";
import { CATEGORIES, type Category } from "@/lib/appliance-types";
import { getEquipmentType } from "@/lib/equipment-types";
import { PROPERTY_TYPES, type PropertyType } from "@/lib/place-types";
import { applyQuestionnaireStepEffects, type QuestionnaireStepEffects } from "@/lib/questionnaire-effects";

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

export async function updateAppliance(
  id: string,
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const brand = optionalTrimmed(formData, "brand");
  const model = optionalTrimmed(formData, "model");
  const room = optionalTrimmed(formData, "room");
  const purchaseDate = optionalTrimmed(formData, "purchaseDate");
  const powerKwRaw = optionalTrimmed(formData, "powerKw");

  if (purchaseDate && Number.isNaN(Date.parse(purchaseDate))) {
    return { error: "Veuillez saisir une date d'achat valide." };
  }
  let powerKw: number | null = null;
  if (powerKwRaw) {
    powerKw = Number(powerKwRaw);
    if (Number.isNaN(powerKw) || powerKw <= 0) {
      return { error: "Veuillez saisir une puissance valide." };
    }
  }

  await updateApplianceRecord(id, { brand, model, powerKw, purchaseDate, room });
  revalidatePath("/");
  revalidatePath(`/appliances/${id}`);
  redirect(`/appliances/${id}`);
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

  const place = await addPlace({ name, commune, postcode, propertyType: propertyType as PropertyType | null });
  revalidatePath("/");
  redirect(`/places/${place.id}/questionnaire`);
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

export async function removePlace(id: string): Promise<void> {
  await deletePlace(id);
  revalidatePath("/");
  redirect("/");
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// "C'est fait": the user only gives a month (input type="month", MM/AAAA on screen),
// stored as day 1 of that month. Clears any stale known_due_date so the status is
// recomputed from this new last_service_date going forward (setApplianceObligation
// overwrites known_due_date to null when it isn't passed).
export async function markObligationDone(
  applianceId: string,
  maintenanceTaskId: string,
  month: string
): Promise<void> {
  if (!MONTH_PATTERN.test(month)) {
    throw new Error("Mois invalide");
  }
  await setApplianceObligation({ applianceId, maintenanceTaskId, lastServiceDate: `${month}-01` });
  revalidatePath("/");
  revalidatePath(`/appliances/${applianceId}`);
}

export async function submitQuestionnaireStep(effects: QuestionnaireStepEffects): Promise<void> {
  await applyQuestionnaireStepEffects(effects);
}

export async function completeQuestionnaire(placeId: string): Promise<void> {
  await markPlaceOnboarded(placeId);
  revalidatePath("/");
  redirect("/");
}
