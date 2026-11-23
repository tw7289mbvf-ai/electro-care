// Working days for the booking queue (spec "Booking Requests": "no answer within three
// working days"): Monday to Friday, French public holidays not counted out — step 1 is
// a hand-run queue, a holiday only makes the flag a day early.
export function addBusinessDays(fromIso: string, days: number): string {
  const d = new Date(`${fromIso.slice(0, 10)}T12:00:00Z`);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return d.toISOString().slice(0, 10);
}

export function isPastBusinessDays(fromIso: string, days: number, todayIso: string): boolean {
  return addBusinessDays(fromIso, days) <= todayIso;
}
