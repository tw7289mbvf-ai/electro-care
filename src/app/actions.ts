"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addAppliance,
  deleteAppliance,
  getAppliance,
  importApplianceFromInvoice,
  setAppliancePowerKw,
  updateAppliance as updateApplianceRecord,
} from "@/lib/appliances";
import {
  addPlace,
  deletePlace,
  getPlace,
  getPlaces,
  markPlaceOnboarded,
  updatePlace as updatePlaceRecord,
  updatePlaceMaintenanceLevel,
} from "@/lib/places";
import { setApplianceObligation } from "@/lib/appliance-obligations";
import {
  recordObligationCompletion,
  editObligationCompletion,
  getLatestObligationCompletion,
} from "@/lib/obligation-completions";
import { setObligationAppointment, deleteObligationAppointment } from "@/lib/obligation-appointments";
import { getTodayInFrance } from "@/lib/obligations";
import { dateAnswerToObligationFields, type DateAnswerResult } from "@/lib/date-answer";
import { recordMaintenanceCompletion, editMaintenanceCompletion } from "@/lib/maintenance-completions";
import { deferMaintenanceTask, clearMaintenanceDeferral, getMaintenanceDeferral } from "@/lib/maintenance-deferrals";
import { canDeferMaintenanceTask } from "@/lib/maintenance-guidance";
import { currentMonthKey, addMonthsToKey } from "@/lib/french-dates";
import { CATEGORIES, type Category } from "@/lib/appliance-types";
import { getEquipmentType } from "@/lib/equipment-types";
import { getMaintenanceTask } from "@/lib/maintenance-tasks";
import { PROPERTY_TYPES, type PropertyType } from "@/lib/place-types";
import { MAINTENANCE_LEVELS, type MaintenanceLevel } from "@/lib/maintenance-levels";
import { applyQuestionnaireStepEffects, type QuestionnaireStepEffects } from "@/lib/questionnaire-effects";
import { createDeletionRequest, createContactMessage } from "@/lib/account-requests";
import { auth } from "@/lib/auth/server";
import { requireAdminRoute } from "@/lib/admin";
import {
  extractAppliancesFromInvoice,
  DEMO_INVOICE_APPLIANCES,
  getInvoiceImportMode,
  type ExtractedApplianceCandidate,
} from "@/lib/invoice-extraction";

export type FormState = {
  error?: string;
};

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

function isPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

function isMaintenanceLevel(value: string): value is MaintenanceLevel {
  return (MAINTENANCE_LEVELS as readonly string[]).includes(value);
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
  revalidatePath(`/places/${placeId}`);
  return {};
}

export async function removeAppliance(id: string): Promise<void> {
  const appliance = await getAppliance(id);
  await deleteAppliance(id);
  revalidatePath("/");
  if (appliance) revalidatePath(`/places/${appliance.placeId}`);
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
  const warrantyEnd = optionalTrimmed(formData, "warrantyEnd");
  const powerKwRaw = optionalTrimmed(formData, "powerKw");

  if (purchaseDate && Number.isNaN(Date.parse(purchaseDate))) {
    return { error: "Veuillez saisir une date d'achat valide." };
  }
  if (warrantyEnd && Number.isNaN(Date.parse(warrantyEnd))) {
    return { error: "Veuillez saisir une fin de garantie valide." };
  }
  let powerKw: number | null = null;
  if (powerKwRaw) {
    powerKw = Number(powerKwRaw);
    if (Number.isNaN(powerKw) || powerKw <= 0) {
      return { error: "Veuillez saisir une puissance valide." };
    }
  }

  await updateApplianceRecord(id, { brand, model, powerKw, purchaseDate, warrantyEnd, room });
  revalidatePath("/");
  revalidatePath(`/appliances/${id}`);
  redirect(`/appliances/${id}`);
}

export async function createPlace(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = optionalTrimmed(formData, "name");
  const commune = optionalTrimmed(formData, "commune");
  const postcode = optionalTrimmed(formData, "postcode");
  const streetAddress = optionalTrimmed(formData, "streetAddress");
  const addressComplement = optionalTrimmed(formData, "addressComplement");
  const propertyType = optionalTrimmed(formData, "propertyType");

  if (!name) {
    return { error: "Veuillez saisir un nom pour le lieu." };
  }
  if (propertyType && !isPropertyType(propertyType)) {
    return { error: "Veuillez choisir un type de bien valide." };
  }

  const place = await addPlace({
    name,
    commune,
    postcode,
    streetAddress,
    addressComplement,
    propertyType: propertyType as PropertyType | null,
  });
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
  const streetAddress = optionalTrimmed(formData, "streetAddress");
  const addressComplement = optionalTrimmed(formData, "addressComplement");
  const propertyType = optionalTrimmed(formData, "propertyType");

  if (!name) {
    return { error: "Veuillez saisir un nom pour le lieu." };
  }
  if (propertyType && !isPropertyType(propertyType)) {
    return { error: "Veuillez choisir un type de bien valide." };
  }

  await updatePlaceRecord(id, {
    name,
    commune,
    postcode,
    streetAddress,
    addressComplement,
    propertyType: propertyType as PropertyType | null,
  });
  revalidatePath("/");
  revalidatePath(`/places/${id}`);
  redirect(`/places/${id}`);
}

export async function removePlace(id: string): Promise<void> {
  await deletePlace(id);
  revalidatePath("/");
  redirect("/");
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// "C'est fait"/"Modifier": current month or a past one, never a future one — a done
// intervention is a proof (spec's "Managing Appliances"). `month` is "YYYY-MM".
function isFutureMonth(month: string): boolean {
  return month > currentMonthKey();
}

// appliance_obligations (the "current status" record obligations.ts computes from) is
// always re-derived from obligation_completions' own latest row after a history write,
// rather than from the value that write just submitted — an edit can make an older
// entry the new latest one, or make a previously-latest one no longer the latest.
async function syncObligationFromHistory(applianceId: string, maintenanceTaskId: string): Promise<void> {
  const latest = await getLatestObligationCompletion(applianceId, maintenanceTaskId);
  if (!latest) return;
  await setApplianceObligation({
    applianceId,
    maintenanceTaskId,
    lastServiceDate: latest.serviceDate,
    providerName: latest.providerName,
    providerContact: latest.providerContact,
    modified: latest.modifiedAt !== null,
  });
}

// "C'est fait": the user only gives a month (input type="month", MM/AAAA on screen),
// stored as day 1 of that month. Appends a history entry (spec's "Managing Appliances",
// "History, never overwritten") and resyncs the current-status record from it.
export async function markObligationDone(
  applianceId: string,
  maintenanceTaskId: string,
  month: string,
  providerName: string | null = null,
  providerContact: string | null = null
): Promise<void> {
  if (!MONTH_PATTERN.test(month) || isFutureMonth(month)) {
    throw new Error("Mois invalide");
  }
  await recordObligationCompletion({
    applianceId,
    maintenanceTaskId,
    serviceDate: `${month}-01`,
    providerName: providerName?.trim() || null,
    providerContact: providerContact?.trim() || null,
  });
  await syncObligationFromHistory(applianceId, maintenanceTaskId);
  // "Le rendez-vous a-t-il eu lieu ? Oui" (spec's "Managing Appliances") funnels into
  // this same action, prefilled — and any other "C'est fait" on a task that happened to
  // have a pending appointment resolves it the same way. No-op when there was none.
  await deleteObligationAppointment(applianceId, maintenanceTaskId);
  revalidatePath("/");
  revalidatePath(`/appliances/${applianceId}`);
  const appliance = await getAppliance(applianceId);
  if (appliance) revalidatePath(`/places/${appliance.placeId}`);
}

// "Rendez-vous pris" (spec's "Managing Appliances"): only on a red or orange obligation,
// a future date to the day and a provider — replaces any appointment already pending for
// this task (also used by "Reprogrammer").
export async function bookObligationAppointment(
  applianceId: string,
  maintenanceTaskId: string,
  appointmentDate: string,
  providerName: string,
  providerContact: string | null = null
): Promise<{ error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || appointmentDate <= getTodayInFrance()) {
    return { error: "Date invalide" };
  }
  if (!providerName.trim()) {
    return { error: "Le prestataire est requis" };
  }
  await setObligationAppointment({
    applianceId,
    maintenanceTaskId,
    appointmentDate,
    providerName: providerName.trim(),
    providerContact: providerContact?.trim() || null,
  });
  revalidatePath("/");
  revalidatePath(`/appliances/${applianceId}`);
  const appliance = await getAppliance(applianceId);
  if (appliance) revalidatePath(`/places/${appliance.placeId}`);
  return {};
}

// "Non" + "Annuler" (spec's "Managing Appliances"): the obligation returns to its
// ordinary status.
export async function cancelObligationAppointment(applianceId: string, maintenanceTaskId: string): Promise<void> {
  await deleteObligationAppointment(applianceId, maintenanceTaskId);
  revalidatePath("/");
  revalidatePath(`/appliances/${applianceId}`);
  const appliance = await getAppliance(applianceId);
  if (appliance) revalidatePath(`/places/${appliance.placeId}`);
}

// "Modifier" on a past legal intervention (spec's "Managing Appliances"): corrects one
// history entry (identified by id, since there can now be several), stamping
// modified_at so the fiche shows "modifiée le …".
export async function editObligation(
  id: string,
  applianceId: string,
  maintenanceTaskId: string,
  month: string,
  providerName: string | null,
  providerContact: string | null
): Promise<{ error?: string }> {
  if (!MONTH_PATTERN.test(month) || isFutureMonth(month)) {
    return { error: "Mois invalide" };
  }
  const result = await editObligationCompletion({
    id,
    applianceId,
    maintenanceTaskId,
    serviceDate: `${month}-01`,
    providerName: providerName?.trim() || null,
    providerContact: providerContact?.trim() || null,
  });
  if (result.error) return result;
  await syncObligationFromHistory(applianceId, maintenanceTaskId);
  revalidatePath("/");
  revalidatePath(`/appliances/${applianceId}`);
  const appliance = await getAppliance(applianceId);
  if (appliance) revalidatePath(`/places/${appliance.placeId}`);
  return {};
}

// Orange "Mettre à jour" — power threshold (spec's "Actions and colours"): resolves
// every conditional obligation on this appliance at once, the same as entering the
// power directly in the appliance card.
export async function resolveObligationThreshold(applianceId: string, powerKw: number): Promise<void> {
  if (!Number.isFinite(powerKw) || powerKw <= 0) {
    throw new Error("Puissance invalide");
  }
  const appliance = await setAppliancePowerKw(applianceId, powerKw);
  revalidatePath("/");
  revalidatePath(`/appliances/${applianceId}`);
  revalidatePath(`/places/${appliance.placeId}`);
}

// Orange "Mettre à jour" — a date to pin down (spec's "Actions and colours"): re-asks
// the obligation's own date question, never the plain last-service month "C'est fait"
// uses (a different question, e.g. yes_no or an expiry date rather than "when did you
// last do it").
export async function resolveObligationDate(
  applianceId: string,
  maintenanceTaskId: string,
  result: DateAnswerResult
): Promise<void> {
  await setApplianceObligation({ applianceId, maintenanceTaskId, ...dateAnswerToObligationFields(result) });
  revalidatePath("/");
  revalidatePath(`/appliances/${applianceId}`);
  const appliance = await getAppliance(applianceId);
  if (appliance) revalidatePath(`/places/${appliance.placeId}`);
}

// "Entretien" fiche de tâche: no date to give, no email — just a completion for the
// current month (spec's "Lifespan maintenance, in the app only").
export async function markMaintenanceTaskDone(applianceId: string, maintenanceTaskId: string, placeId: string): Promise<void> {
  await recordMaintenanceCompletion({ applianceId, maintenanceTaskId, doneMonth: currentMonthKey() });
  // Resets the deferral cycle: a later new occurrence must not inherit this one's
  // origin_month (canDeferMaintenanceTask's cap would otherwise start already spent).
  await clearMaintenanceDeferral(applianceId, maintenanceTaskId);
  revalidatePath("/");
  revalidatePath(`/places/${placeId}`);
}

// "Modifier" on a past realisation (spec's "Managing Appliances" / "Fiche de tâche"):
// corrects the month of an existing completion, stamping modified_at.
export async function editMaintenanceCompletionAction(input: {
  id: string;
  applianceId: string;
  maintenanceTaskId: string;
  month: string;
  placeId: string;
}): Promise<{ error?: string }> {
  if (!MONTH_PATTERN.test(input.month) || isFutureMonth(input.month)) {
    return { error: "Mois invalide" };
  }
  const result = await editMaintenanceCompletion({
    id: input.id,
    applianceId: input.applianceId,
    maintenanceTaskId: input.maintenanceTaskId,
    doneMonth: input.month,
  });
  if (result.error) return result;
  revalidatePath("/");
  revalidatePath(`/appliances/${input.applianceId}`);
  revalidatePath(`/appliances/${input.applianceId}/tasks/${input.maintenanceTaskId}`);
  revalidatePath(`/places/${input.placeId}`);
  return {};
}

export async function deferMaintenanceTaskAction(applianceId: string, maintenanceTaskId: string, placeId: string): Promise<void> {
  const task = getMaintenanceTask(maintenanceTaskId);
  if (!task) return;
  const now = currentMonthKey();
  const existing = await getMaintenanceDeferral(applianceId, maintenanceTaskId);
  if (!canDeferMaintenanceTask(task, existing, now)) return;
  await deferMaintenanceTask({
    applianceId,
    maintenanceTaskId,
    originMonth: existing?.originMonth ?? now,
    deferredToMonth: addMonthsToKey(now, 1),
  });
  revalidatePath("/");
  revalidatePath(`/places/${placeId}`);
}

export async function submitQuestionnaireStep(effects: QuestionnaireStepEffects): Promise<void> {
  await applyQuestionnaireStepEffects(effects);
}

export async function completeQuestionnaire(placeId: string): Promise<void> {
  await markPlaceOnboarded(placeId);
  revalidatePath("/");
  redirect("/");
}

export async function updatePlaceMaintenanceLevelAction(placeId: string, level: string): Promise<void> {
  if (!isMaintenanceLevel(level)) {
    throw new Error("Niveau d'entretien invalide");
  }
  await updatePlaceMaintenanceLevel(placeId, level);
  revalidatePath("/");
  revalidatePath(`/places/${placeId}`);
}

async function requireSessionEmail(): Promise<string> {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    throw new Error("Non authentifié");
  }
  return session.user.email;
}

export async function requestAccountDeletion(): Promise<void> {
  const email = await requireSessionEmail();
  await createDeletionRequest(email);
  revalidatePath("/settings");
}

export async function submitContactMessage(_prevState: FormState, formData: FormData): Promise<FormState> {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) {
    return { error: "Veuillez saisir un message." };
  }
  const email = await requireSessionEmail();
  await createContactMessage(email, message);
  revalidatePath("/settings");
  return {};
}

export type InvoiceExtractionState = {
  error?: string;
  rows?: ExtractedApplianceCandidate[];
  demo?: boolean;
};

// Mode is always recomputed here from the session and the env var, never trusted from
// the client: a request that reaches this action with the flag off and a non-admin
// session is refused, whatever form field it was submitted with (see
// src/lib/invoice-extraction.ts, "Import from Invoices (planned)").
export async function extractInvoiceAppliances(
  _prevState: InvoiceExtractionState,
  formData: FormData
): Promise<InvoiceExtractionState> {
  const isAdmin = (await requireAdminRoute()) !== null;
  const mode = getInvoiceImportMode(isAdmin);
  if (mode === "disabled") {
    return { error: "Import de factures : bientôt disponible." };
  }
  if (mode === "demo") {
    return { rows: DEMO_INVOICE_APPLIANCES, demo: true };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Veuillez déposer une facture (PDF ou photo)." };
  }
  try {
    const rows = await extractAppliancesFromInvoice(file);
    return { rows, demo: false };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Lecture de la facture impossible." };
  }
}

export type InvoiceImportRow = {
  equipmentTypeId: string;
  brand: string | null;
  model: string | null;
  purchaseDate: string | null;
  warrantyEnd: string | null;
};

export type InvoiceImportResult = { importedEquipmentTypeIds: string[] } | { error: string };

// The confirmation screen's own submit ("Nous avons trouvé N appareils", each line
// ticked or not): completes an existing appliance of the same type rather than
// duplicating it (CLAUDE.md, "Complete, don't duplicate").
export async function confirmInvoiceImport(placeId: string, rows: InvoiceImportRow[]): Promise<InvoiceImportResult> {
  const isAdmin = (await requireAdminRoute()) !== null;
  if (getInvoiceImportMode(isAdmin) === "disabled") {
    return { error: "Import de factures : bientôt disponible." };
  }
  const place = await getPlace(placeId);
  if (!place) {
    return { error: "Lieu introuvable." };
  }

  const importedEquipmentTypeIds: string[] = [];
  for (const row of rows) {
    const type = getEquipmentType(row.equipmentTypeId);
    if (!type) continue;
    await importApplianceFromInvoice({
      placeId,
      equipmentTypeId: row.equipmentTypeId,
      category: type.category,
      brand: row.brand,
      model: row.model,
      purchaseDate: row.purchaseDate,
      warrantyEnd: row.warrantyEnd,
    });
    importedEquipmentTypeIds.push(row.equipmentTypeId);
  }

  revalidatePath("/");
  revalidatePath(`/places/${placeId}`);
  return { importedEquipmentTypeIds };
}
