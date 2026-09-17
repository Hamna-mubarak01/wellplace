interface Window { readonly opens: string; readonly closes: string }
type Week = Readonly<Record<string, readonly Window[]>>;
export interface OpeningSchedule {
  readonly regular: Week | null;
  readonly seasonal: { readonly periods: readonly { readonly from: string; readonly to: string; readonly hours: Week }[] } | null;
  readonly exceptions: readonly { readonly date: string; readonly windows: readonly Window[] }[] | null;
  readonly closures: readonly { readonly from: string; readonly to: string }[] | null;
}
export function resolveOpeningHours(schedule: OpeningSchedule, date: string): readonly Window[] | null {
  if (schedule.closures?.some((entry) => entry.from <= date && date <= entry.to)) return [];
  const exception = schedule.exceptions?.find((entry) => entry.date === date);
  if (exception) return exception.windows;
  const season = schedule.seasonal?.periods.find((entry) => entry.from <= date && date <= entry.to);
  const week = season?.hours ?? schedule.regular;
  if (!week) return null;
  const weekday = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${date}T12:00:00Z`).getUTCDay()];
  return [...(week[weekday] ?? [])].sort((a, b) => a.opens.localeCompare(b.opens));
}
