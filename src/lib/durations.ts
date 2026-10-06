// The one place a duration becomes text (docs/design.md, "Durées"): under an hour in
// minutes ("45 min"); from an hour, hours and minutes rounded to five minutes
// ("4 h 45", "1 h 05", "2 h"). Callers add "environ" where the design asks for it.
export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const fiveMinutes = Math.round(rounded / 5) * 5;
  const hours = Math.floor(fiveMinutes / 60);
  const rest = fiveMinutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}
