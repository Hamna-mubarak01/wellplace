
export interface CalendarDate {
  readonly day: number;
  readonly month: number;
  readonly year: number;
}

export function daysInMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isRealDate({ day, month, year }: CalendarDate): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(month, year);
}

export function calculateAge(
  { day, month, year }: CalendarDate,
  today: Date = new Date(),
): number {
  const nowMonth = today.getUTCMonth() + 1;
  const nowDay = today.getUTCDate();

  let age = today.getUTCFullYear() - year;
  const hasHadBirthday = nowMonth > month || (nowMonth === month && nowDay >= day);
  if (!hasHadBirthday) age -= 1;
  return age;
}

export function birthYearRange(
  minAge: number,
  maxAge: number,
  today: Date = new Date(),
): { earliest: number; latest: number } {
  const currentYear = today.getUTCFullYear();
  return { earliest: currentYear - maxAge - 1, latest: currentYear - minAge };
}
