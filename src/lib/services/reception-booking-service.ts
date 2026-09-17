import { publishedLegalVersion } from "@/lib/db/queries/legal-content";
import { SUITE_CONFLICT_MESSAGE } from "@/lib/domain/action-errors";
import { requireSetting, type SettingsSnapshot } from "@/lib/config";
import { TERMS_ACCEPTANCE } from "@/lib/config/consent";
import {
  createReceptionBooking,
  type BookingMutation,
  type CreatedBooking,
} from "@/lib/db/rpc";
import { quoteBooking } from "@/lib/services/pricing-service";
import type { WellPlaceClient } from "@/lib/db/types";
import { checkGuestRules, type ReceptionBookingInput } from "@/lib/validation/reception-booking";
import { openingHoursRefusal } from "@/lib/services/opening-hours-service";
import { calculateAge } from "@/lib/domain/age";

export type ReceptionBookingOutcome =
  | { status: "created"; booking: CreatedBooking }
  | { status: "no_suite" }
  | { status: "refused"; message: string }
  | { status: "error"; message: string };

export interface ReceptionBookingOptions {
  readonly canOverridePrice: boolean;
}

function guestRulesFrom(snapshot: SettingsSnapshot) {
  return {
    guestsMin: requireSetting(snapshot, "booking.guests_min"),
    guestsMax: requireSetting(snapshot, "booking.guests_max"),
    childMinAge: requireSetting(snapshot, "booking.child_min_age"),
    childMaxAge: requireSetting(snapshot, "booking.child_max_age"),
    bookerMinAge: requireSetting(snapshot, "booking.booker_min_age"),
  };
}

function isoDate(value: { day: number; month: number; year: number }): string {
  const month = String(value.month).padStart(2, "0");
  const day = String(value.day).padStart(2, "0");
  return `${value.year}-${month}-${day}`;
}

function translate(result: BookingMutation<CreatedBooking>): ReceptionBookingOutcome {
  switch (result.outcome) {
    case "ok":
      return { status: "created", booking: result.value };
    case "no_suite":
      return { status: "no_suite" };
    case "refused":
      return { status: "refused", message: result.message };
    case "failed":
      return { status: "error", message: result.message };
  }
}

export async function createBookingAtReception(
  client: WellPlaceClient,
  snapshot: SettingsSnapshot,
  input: ReceptionBookingInput,
  options: ReceptionBookingOptions,
): Promise<ReceptionBookingOutcome> {
  if (!requireSetting(snapshot, "booking.durations_hours").includes(input.durationHours)) {
    return { status: "refused", message: "That duration is no longer offered. Choose an available duration." };
  }
  const hoursRefusal = openingHoursRefusal(snapshot, input.startsAt, input.durationHours * 60);
  if (hoursRefusal) return { status: "refused", message: hoursRefusal };
  const rules = guestRulesFrom(snapshot);

  const failure = checkGuestRules(
    {
      adults: input.adults,
      children: input.children,
      bookerAge: calculateAge(input.dateOfBirth),
    },
    rules,
  );

  if (failure !== null) {
    return { status: "refused", message: failure.message };
  }

  const quote = await quoteBooking(client, snapshot, {
    startsAt: input.startsAt,
    durationHours: input.durationHours,
    adults: input.adults,
    childAges: input.children.map((child) => child.age),
    addonQuantities: Object.fromEntries(
      input.addons.map((addon) => [addon.addonId, addon.quantity]),
    ),
    voucherCode: input.voucherCode ?? null,
    customerId: input.customerId ?? null,
    manualTotalFils: null,
  });

  if (quote.voucherMessage !== null) {
    return { status: "refused", message: quote.voucherMessage };
  }

  const calculated = quote.breakdown.outcome === "priced" ? quote.breakdown : null;
  const complimentary = input.source === "complimentary";

  if (calculated === null && input.manualTotalFils === null && !complimentary) {
    return {
      status: "refused",
      message:
        "No price could be calculated for that date and duration, and no agreed price was entered.",
    };
  }

  const overrides =
    input.manualTotalFils !== null &&
    calculated !== null &&
    input.manualTotalFils !== calculated.totalFils;

  if (overrides && !options.canOverridePrice) {
    return {
      status: "refused",
      message:
        "Changing a calculated price needs the manual price change permission. Ask Management.",
    };
  }

  const voucherCode = quote.voucher?.code ?? null;

  const priced = complimentary
    ? {
        subtotalFils: 0,
        discountFils: 0,
        addonsFils: 0,
        serviceFeeFils: 0,
        taxFils: 0,
        totalFils: 0,
        voucherCode,
      }
    : input.manualTotalFils !== null
      ? {
          subtotalFils: input.manualTotalFils,
          discountFils: 0,
          addonsFils: 0,
          serviceFeeFils: 0,
          taxFils: 0,
          totalFils: input.manualTotalFils,
          voucherCode,
        }
      : calculated === null
        ? {
            subtotalFils: 0,
            discountFils: 0,
            addonsFils: 0,
            serviceFeeFils: 0,
            taxFils: 0,
            totalFils: 0,
            voucherCode,
          }
        : {
            subtotalFils: calculated.subtotalFils,
            discountFils: calculated.discountFils,
            addonsFils: calculated.addonsTotalFils,
            serviceFeeFils: calculated.serviceFeeFils,
            taxFils: calculated.taxFils,
            totalFils: calculated.totalFils,
            voucherCode,
          };

  const legalVersion = await publishedLegalVersion(client);
  const result = await createReceptionBooking(client, {
    customerId: input.customerId,
    suiteId: input.suiteId,
    source: input.source,
    salutation: input.salutation,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    dateOfBirth: isoDate(input.dateOfBirth),
    phoneE164: input.phone.e164,
    phoneCountry: input.phone.countryIso2,
    startsAt: input.startsAt,
    durationHours: input.durationHours,
    bufferMinutes: requireSetting(snapshot, "cleaning.buffer_minutes"),
    adults: input.adults,
    childAges: input.children.map((child) => child.age),
    addons: quote.cart.map((addon) => ({
      addonId: addon.id,
      quantity: addon.quantity,
    })),
    personalRequest: input.personalRequest ?? "",
    internalNote: input.internalNote ?? "",
    price: priced,
    isComplimentary: input.source === "complimentary",
    acceptance: TERMS_ACCEPTANCE.documents.map((slug) => ({
      documentSlug: slug,
      documentVersion: legalVersion,
      checkboxText: TERMS_ACCEPTANCE.text,
    })),
    reason: input.reason?.trim() || "Created at Reception",
    paymentMethod: input.paymentMethod,
  });

  if (result.outcome === "no_suite" && input.suiteId) {
    return { status: "refused", message: SUITE_CONFLICT_MESSAGE };
  }
  return translate(result);
}
