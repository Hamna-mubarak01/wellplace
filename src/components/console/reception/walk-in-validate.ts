import type { DateOfBirthValue } from "@/components/shared/dob-select";
import type { PhoneValue } from "@/components/shared/phone-input";
import { toE164 } from "@/components/shared/phone-input";
import {
  receptionBookingSchema,
  type GuestRuleFailure,
  type ReceptionBookingInput,
} from "@/lib/validation/reception-booking";
import { parseAed } from "@/components/shared/money";
import type { DeskPaymentMethod } from "@/lib/config/reception";
import {
  issuesToErrors,
  type ReceptionSource,
  type Salutation,
} from "@/components/console/reception/walk-in-form";

export interface AgreedPrice {
  readonly manualTotalFils: number | null;
  readonly supplied: boolean;
  readonly malformed: boolean;
}

export function resolveAgreedPrice(
  source: ReceptionSource,
  raw: string,
): AgreedPrice {
  if (source === "complimentary") {
    return { manualTotalFils: 0, supplied: true, malformed: false };
  }

  const trimmed = raw.trim();
  if (trimmed === "") {
    return { manualTotalFils: null, supplied: false, malformed: false };
  }

  const parsed = parseAed(trimmed);
  return {
    manualTotalFils: parsed,
    supplied: true,
    malformed: parsed === null,
  };
}

export interface WalkInDraft {
  readonly source: ReceptionSource;
  readonly salutation: Salutation;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly dateOfBirth: DateOfBirthValue;
  readonly phone: PhoneValue;
  readonly startsAt: string | null;
  readonly durationHours: number;
  readonly adults: number;
  readonly childAges: readonly (number | null)[];
  readonly cart: readonly { readonly id: string; readonly quantity: number }[];
  readonly voucherCode: string;
  readonly personalRequest: string;
  readonly internalNote: string;
  readonly reason: string;
  readonly acceptedTerms: boolean;
  readonly paymentMethod: DeskPaymentMethod;
}

export interface WalkInContext {
  readonly agreedPrice: AgreedPrice;
  readonly hasCalculatedPrice: boolean;
  readonly ruleFailure: GuestRuleFailure | null;
}

export type WalkInValidation =
  | { ok: true; data: ReceptionBookingInput }
  | { ok: false; errors: Record<string, string> };

export function validateWalkIn(
  draft: WalkInDraft,
  context: WalkInContext,
): WalkInValidation {
  const { dateOfBirth, childAges } = draft;
  const { agreedPrice, hasCalculatedPrice, ruleFailure } = context;

  const parsed = receptionBookingSchema.safeParse({
    source: draft.source,
    salutation: draft.salutation,
    firstName: draft.firstName,
    lastName: draft.lastName,
    email: draft.email.trim(),
    dateOfBirth: {
      day: dateOfBirth.day ?? undefined,
      month: dateOfBirth.month ?? undefined,
      year: dateOfBirth.year ?? undefined,
    },
    phone: { e164: toE164(draft.phone), countryIso2: draft.phone.countryIso2 },
    startsAt: draft.startsAt ?? "",
    durationHours: draft.durationHours,
    adults: draft.adults,
    children: childAges.map((age) => ({ age: age ?? -1 })),
    addons: draft.cart
      .filter((line) => line.quantity > 0)
      .map((line) => ({ addonId: line.id, quantity: line.quantity })),
    personalRequest: draft.personalRequest.trim() || undefined,
    internalNote: draft.internalNote.trim() || undefined,
    manualTotalFils: agreedPrice.manualTotalFils,
    acceptedTerms: draft.acceptedTerms,
    paymentMethod: draft.paymentMethod,
    reason: draft.reason.trim() || undefined,
    voucherCode: draft.voucherCode.trim() || undefined,
  });

  const errors = parsed.success ? {} : issuesToErrors(parsed.error.issues);

  if (
    dateOfBirth.day === null ||
    dateOfBirth.month === null ||
    dateOfBirth.year === null
  ) {
    for (const key of Object.keys(errors)) {
      if (key.startsWith("dateOfBirth")) delete errors[key];
    }
    errors.dateOfBirth = "Choose the guest's date of birth.";
  }

  if (childAges.some((age) => age === null)) {
    for (const key of Object.keys(errors)) {
      if (key.startsWith("children")) delete errors[key];
    }
    errors.children = "Choose an age for every child.";
  }

  if (draft.startsAt === null) {
    errors.startsAt = "Choose a start time.";
  }

  if (agreedPrice.malformed) {
    errors.manualTotalFils = "Enter the price in AED, for example 450.00.";
  } else if (!agreedPrice.supplied && !hasCalculatedPrice) {
    errors.manualTotalFils =
      "Enter the price agreed with the guest. No price list has been supplied yet.";
  }

  if (agreedPrice.manualTotalFils !== null && draft.reason.trim() === "") {
    errors.reason = "Give a reason for this price. It is stored in the audit log.";
  }

  if (ruleFailure) {
    errors.guests = ruleFailure.message;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  if (!parsed.success) return { ok: false, errors: { form: "Check the form." } };

  return { ok: true, data: parsed.data };
}
