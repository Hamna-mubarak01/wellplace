import { requireSetting, type SettingsSnapshot } from "@/lib/config";
import { calculateAge } from "@/lib/domain/age";
import { bookableStarts } from "@/lib/domain/schedule";
import { todayInDubai, toCalendarDate } from "@/lib/domain/time";
import { openingHoursRefusal, windowsForDate } from "@/lib/services/opening-hours-service";

export function guestPartyRefusal(settings: SettingsSnapshot, request: {
  startsAt: string; durationHours: number; adults: number; childAges: readonly number[]; dateOfBirth?: string;
}, now = new Date()): string | null {
  const durations = requireSetting(settings, "booking.durations_hours");
  if (!durations.includes(request.durationHours)) return "This visit length is no longer offered. Choose another duration.";
  const total = request.adults + request.childAges.length;
  const min = requireSetting(settings, "booking.guests_min");
  const max = requireSetting(settings, "booking.guests_max");
  if (request.adults < 1 || total < min || total > max) return `Choose ${min}–${max} guests, including at least one adult.`;
  const childMin = requireSetting(settings, "booking.child_min_age");
  const childMax = requireSetting(settings, "booking.child_max_age");
  if (request.childAges.some((age) => age < childMin || age > childMax)) return `Child ages must be between ${childMin} and ${childMax}. Update your guests.`;
  if (request.dateOfBirth) {
    const age = calculateAge(toCalendarDate(request.dateOfBirth), new Date(`${todayInDubai(now)}T12:00:00Z`));
    const bookerMin = requireSetting(settings, "booking.booker_min_age");
    if (age < bookerMin) return `The person booking must be at least ${bookerMin}. Update your date of birth.`;
  }
  return null;
}

export function guestBookingRefusal(settings: SettingsSnapshot, request: {
  startsAt: string; durationHours: number; adults: number; childAges: readonly number[]; dateOfBirth?: string;
}, now = new Date()): string | null {
  const party = guestPartyRefusal(settings, request, now);
  if (party) return party;
  const hoursRefusal = openingHoursRefusal(settings, request.startsAt, request.durationHours * 60);
  if (hoursRefusal) return hoursRefusal;
  const date = toCalendarDate(todayInDubai(new Date(request.startsAt)));
  const previous = toCalendarDate(todayInDubai(new Date(Date.parse(request.startsAt) - 86_400_000)));
  const starts = [date, previous].flatMap((day) => bookableStarts({ date: day, windows: windowsForDate(settings, day) ?? [],
    intervalMinutes: requireSetting(settings, "booking.start_interval_minutes"),
    durationHours: request.durationHours, maxHorizonDays: requireSetting(settings, "booking.max_horizon_days"), now }));
  return starts.some((start) => start.getTime() === new Date(request.startsAt).getTime())
    ? null : "This start time is no longer offered. Choose an available time.";
}
