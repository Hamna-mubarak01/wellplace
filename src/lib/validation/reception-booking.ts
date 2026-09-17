import { z } from "zod";
import { BOOKING_NOTE_MAX_LENGTH, CONSOLE_MONEY_AED, REASON_MAX_LENGTH, VOUCHER_CODE_MAX_LENGTH } from "@/lib/config/console-limits";
import { DESK_PAYMENT_METHODS } from "@/lib/config/reception";

import { dateOfBirthSchema, phoneSchema, salutationSchema } from "@/lib/validation/waitlist";

const NAME_MAX = 80;
const EMAIL_MAX = 254;
const NOTE_MAX = BOOKING_NOTE_MAX_LENGTH;

export const RECEPTION_SOURCES = [
  "walk_in",
  "telephone",
  "manual",
  "complimentary",
] as const;

export const receptionSourceSchema = z.enum(RECEPTION_SOURCES);

export const childGuestSchema = z.object({
  age: z.coerce.number().int().nonnegative(),
});

export const receptionBookingSchema = z.object({
  customerId: z.uuid().nullable().optional(),
  suiteId: z.uuid().nullable().optional(),
  source: receptionSourceSchema,

  salutation: salutationSchema,
  firstName: z.string().trim().min(1, "Enter a first name.").max(NAME_MAX),
  lastName: z.string().trim().min(1, "Enter a last name.").max(NAME_MAX),
  email: z.email("Enter a valid email address.").max(EMAIL_MAX),
  dateOfBirth: dateOfBirthSchema,
  phone: phoneSchema,

  startsAt: z.iso.datetime({ offset: true }),
  durationHours: z.coerce.number().int().positive(),

  adults: z.coerce.number().int().positive(),
  children: z.array(childGuestSchema),

  addons: z.array(
    z.object({
      addonId: z.uuid(),
      quantity: z.coerce.number().int().positive(),
    }),
  ),

  personalRequest: z.string().trim().max(NOTE_MAX).optional(),
  internalNote: z.string().trim().max(NOTE_MAX).optional(),

  manualTotalFils: z.coerce.number().int().nonnegative().max(CONSOLE_MONEY_AED.max * 100, `Enter a price no greater than AED ${CONSOLE_MONEY_AED.max.toLocaleString("en-US")}.`).nullable(),

  acceptedTerms: z.literal(true, {
    message: "The guest must accept the terms before the booking is made.",
  }),

  paymentMethod: z.enum(DESK_PAYMENT_METHODS, { message: "Choose how the guest paid." }),

  voucherCode: z.string().trim().max(VOUCHER_CODE_MAX_LENGTH).optional(),

  reason: z.string().trim().max(REASON_MAX_LENGTH, `Keep the reason to ${REASON_MAX_LENGTH} characters or fewer.`).optional(),
});

export type ReceptionBookingInput = z.infer<typeof receptionBookingSchema>;

export interface GuestRules {
  readonly guestsMin: number;
  readonly guestsMax: number;
  readonly childMinAge: number;
  readonly childMaxAge: number;
  readonly bookerMinAge: number;
}

export type GuestRuleFailure =
  | { code: "too_few_guests"; message: string }
  | { code: "too_many_guests"; message: string }
  | { code: "child_too_young"; message: string }
  | { code: "child_too_old"; message: string }
  | { code: "no_adult"; message: string }
  | { code: "booker_too_young"; message: string };

export function checkGuestRules(
  input: {
    adults: number;
    children: readonly { age: number }[];
    bookerAge: number | null;
  },
  rules: GuestRules,
): GuestRuleFailure | null {
  const total = input.adults + input.children.length;

  if (input.adults < 1) {
    return {
      code: "no_adult",
      message: "Every booking must include at least one adult.",
    };
  }

  if (total < rules.guestsMin) {
    return {
      code: "too_few_guests",
      message: `This booking has ${total} guests, but at least ${rules.guestsMin} are required. Check the guest count before continuing.`,
    };
  }

  if (total > rules.guestsMax) {
    return {
      code: "too_many_guests",
      message: `This booking has ${total} guests, but the maximum is ${rules.guestsMax}, including children. Reduce the guest count or arrange separate bookings for the group.`,
    };
  }

  for (const child of input.children) {
    if (child.age < rules.childMinAge) {
      return {
        code: "child_too_young",
        message: `Children under ${rules.childMinAge} cannot be added.`,
      };
    }
    if (child.age > rules.childMaxAge) {
      return {
        code: "child_too_old",
        message: `From ${rules.childMaxAge + 1}, a guest pays the adult price and is counted as an adult.`,
      };
    }
  }

  if (input.bookerAge !== null && input.bookerAge < rules.bookerMinAge) {
    return {
      code: "booker_too_young",
      message: `The person making the booking must be at least ${rules.bookerMinAge}.`,
    };
  }

  return null;
}
