import type { TimeSlot } from "@/components/shared/time-tile";
import type { CartAddon } from "@/lib/domain/vouchers";


export type DayStatus = "open" | "closed" | "hours-unpublished";

export interface BookingDay {
  readonly date: string;
  readonly label: string;
  readonly status: DayStatus;
  readonly slotsByDuration: Readonly<Record<number, readonly TimeSlot[]>>;
  readonly messageByDuration: Readonly<Record<number, string | null>>;
}

export interface BookingLimits {
  readonly durationsHours: readonly number[];
  readonly guestsMin: number;
  readonly guestsMax: number;
  readonly childMinAge: number;
  readonly childMaxAge: number;
  readonly bookerMinAge: number;
  readonly holdMinutes: number;
}

export interface GuestSelection {
  readonly adults: number;
  readonly childAges: readonly (number | null)[];
}

export function totalGuests(guests: GuestSelection): number {
  return guests.adults + guests.childAges.length;
}

export interface AlternativeDate {
  readonly date: string;
  readonly label: string;
}

export { ADDON_KIND_LABEL, addonKindLabel, type AddonKind } from "@/lib/config/addons";

export interface BookingAddonCard extends CartAddon {
  readonly isTaxable?: boolean;
  readonly description: string | null;
  readonly imagePath: string | null;
  readonly savingLabel: string | null;
  readonly kind: string;
  readonly isSoldOut: boolean;
}

export function guestsError(
  guests: GuestSelection,
  limits: BookingLimits,
): string | null {
  if (guests.childAges.some((age) => age === null)) {
    return "Choose an age for every child. We price the booking from the age — a date of birth is not needed.";
  }

  const total = totalGuests(guests);
  if (total < limits.guestsMin) {
    const short = limits.guestsMin - total;
    return `Add ${short} more ${short === 1 ? "guest" : "guests"}. A suite is booked for at least ${limits.guestsMin} people.`;
  }
  if (total > limits.guestsMax) {
    return `A suite takes up to ${limits.guestsMax} guests. Remove ${total - limits.guestsMax}.`;
  }

  return null;
}
