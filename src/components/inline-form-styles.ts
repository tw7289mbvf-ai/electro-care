// Shared classes for the small inline windows opened from a row (MarkDoneButton,
// ModifyObligationButton, ModifyMaintenanceCompletionButton) — kept in one place so the
// three "C'est fait" / "Mettre à jour" / "Modifier" flows look identical.
export const BUTTON_CLASS =
  "rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60";
export const GHOST_BUTTON_CLASS =
  "rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";
export const INPUT_CLASS =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
export const WINDOW_CLASS =
  "flex w-full flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900";
// The edit warning gets its own tint so it reads as "careful" rather than "routine".
export const EDIT_WINDOW_CLASS =
  "flex w-full flex-col gap-2 rounded-lg border border-orange-200 bg-orange-50/60 p-2.5 text-xs dark:border-orange-900/50 dark:bg-orange-950/20";

// Spec's "Managing Appliances": shown before an edit to an already-recorded
// intervention or realisation, on both the legal-obligation and the maintenance-task
// flows.
export const MODIFY_WARNING =
  "Attention : vous modifiez une intervention déjà enregistrée. Le statut et la prochaine échéance seront recalculés.";
