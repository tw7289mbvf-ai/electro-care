import { BUTTON_NEUTRAL, BUTTON_PRIMARY, BUTTON_TEXT, INPUT_CLASS as UI_INPUT_CLASS } from "@/components/ui";

// Shared classes for the small inline windows opened from a row (MarkDoneButton,
// ModifyObligationButton, ModifyMaintenanceCompletionButton) — kept in one place so the
// three "C'est fait" / "Mettre à jour" / "Modifier" flows look identical.
export const BUTTON_CLASS = BUTTON_PRIMARY;
export const GHOST_BUTTON_CLASS = BUTTON_NEUTRAL;
export const TEXT_BUTTON_CLASS = BUTTON_TEXT;
export const INPUT_CLASS = UI_INPUT_CLASS;
export const WINDOW_CLASS = "flex w-full flex-col gap-2.5 rounded-2xl bg-surface-2 p-3 text-sm text-ink";
// The edit warning gets its own tint so it reads as "careful" rather than "routine".
export const EDIT_WINDOW_CLASS = "flex w-full flex-col gap-2.5 rounded-2xl bg-warn-soft p-3 text-sm text-ink";

// Spec's "Managing Appliances": shown before an edit to an already-recorded
// intervention or realisation, on both the legal-obligation and the maintenance-task
// flows.
export const MODIFY_WARNING =
  "Attention : vous modifiez une intervention déjà enregistrée. Le statut et la prochaine échéance seront recalculés.";
