import { z } from "zod";
import {
  RECEPTION_IDENTITY_LIMITS,
  SPECIAL_REQUEST_MAX_LENGTH,
  CONSOLE_MONEY_AED,
} from "@/lib/config/console-limits";

export const CHECKOUT_FLOW = {
  abandonedMinutes: 30,
  maxAddonLines: 50,
  saveDelayMilliseconds: 600,
  quoteRefreshMilliseconds: 30_000,
  maxGuests: 64,
  maxQuantity: 999,
  maxAmountFils: CONSOLE_MONEY_AED.max * 100,
  codeLength: 40,
  steps: ["details", "when", "addons", "confirm", "payment"] as const,
  currency: "AED",
} as const;

export const checkoutIdentitySchema = z
  .object({
    salutation: z.enum(["mr", "ms"], "Choose Mr. or Ms."),
    firstName: z
      .string()
      .trim()
      .min(1, "Enter your first name.")
      .max(RECEPTION_IDENTITY_LIMITS.nameMaxLength),
    lastName: z
      .string()
      .trim()
      .min(1, "Enter your last name.")
      .max(RECEPTION_IDENTITY_LIMITS.nameMaxLength),
    email: z
      .email("Enter a valid email address.")
      .max(RECEPTION_IDENTITY_LIMITS.emailMaxLength)
      .transform((value) => value.toLowerCase()),
    dateOfBirth: z.iso.date("Enter your date of birth."),
    phoneE164: z
      .string()
      .regex(
        /^\+[1-9]\d{6,14}$/,
        "Enter a complete mobile number, including the country code.",
      ),
    phoneCountry: z.string().regex(/^[A-Z]{2}$/, "Choose the country for your mobile number."),
  })
  .strict();
export const checkoutSelectionSchema = z
  .object({
    date: z.iso.date().optional(),
    startsAt: z.iso.datetime({ offset: true }).nullable(),
    durationHours: z.number().int().positive().max(24),
    adults: z.number().int().positive().max(CHECKOUT_FLOW.maxGuests),
    childAges: z
      .array(z.number().int().nonnegative().max(120))
      .max(CHECKOUT_FLOW.maxGuests),
    addonQuantities: z
      .record(z.uuid(), z.number().int().nonnegative().max(CHECKOUT_FLOW.maxQuantity))
      .refine((quantities) => Object.keys(quantities).length <= CHECKOUT_FLOW.maxAddonLines, {
        error: "Too many add-ons were selected. Review your add-ons and try again.",
      }),
    voucherCode: z
      .string()
      .trim()
      .toUpperCase()
      .max(CHECKOUT_FLOW.codeLength)
      .default(""),
    personalRequest: z
      .string()
      .trim()
      .max(SPECIAL_REQUEST_MAX_LENGTH)
      .default(""),
    paymentOption: z.enum(["card", "tabby"]).default("card"),
  })
  .strict();
export const checkoutProgressSchema = z
  .object({
    identity: checkoutIdentitySchema,
    selection: checkoutSelectionSchema,
    acceptedTerms: z.literal(true, {
      error: "Accept the booking terms to continue.",
    }),
    lastCompletedStep: z.enum(CHECKOUT_FLOW.steps),
  })
  .strict();
export const checkoutPaymentSchema = checkoutProgressSchema.extend({
  expectedTotalFils: z.number().int().min(0).max(CHECKOUT_FLOW.maxAmountFils),
  revision: z.string().min(1).max(128),
  requestId: z.uuid(),
});
export const simulationOutcomeSchema = z
  .object({
    paymentId: z.uuid(),
    outcome: z.enum(["success", "failed", "cancelled"]),
  })
  .strict();
export type CheckoutProgress = z.infer<typeof checkoutProgressSchema>;
export type CheckoutSelection = z.infer<typeof checkoutSelectionSchema>;
export type CheckoutPayment = z.infer<typeof checkoutPaymentSchema>;
export type SimulationOutcome = z.infer<typeof simulationOutcomeSchema>;
export type CheckoutResult<T> =
  { ok: true; value: T } | { ok: false; message: string };
export interface SavedCheckout extends CheckoutProgress {
  recovered: boolean;
  receiptToken: string | null;
  pendingPayment?: PreparedPayment | null;
}
export interface PreparedPayment {
  paymentId: string;
  amountFils: number;
  currency: string;
  expiresAt: string;
  simulated: boolean;
  redirectUrl?: string | null;
}
export interface SettledPayment {
  status: "confirmed" | "refunded" | "failed" | "cancelled" | "pending";
  receiptToken: string | null;
  reference: string;
}
