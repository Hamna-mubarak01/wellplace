"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import {
  GUEST_CHECKOUT,
} from "@/lib/config/guest-checkout";
import {
  checkoutRevision,
  guestVoucher,
  loadCheckoutProgress,
  saveCheckoutProgress,
  prepareGuestPayment,
  ownedGuestPayment,
  loadGuestFeeSettings,
  GuestCheckoutError,
} from "@/lib/db/guest-checkout";
import {
  holdGuestVisit,
  releaseGuestVisit,
} from "@/lib/services/guest-checkout-service";

import {
  QUOTE_RATE_LIMITED,
  QUOTE_REJECTED,
  QUOTE_UNAVAILABLE,
  type GuestQuoteResult,
} from "@/app/(site)/book/quote-types";
import { guestQuoteSchema, priceGuestBooking } from "@/app/(site)/book/quote";
import { createClient } from "@/lib/db/server";
import { loadPublicBookingSettings } from "@/lib/db/queries/public-settings";
import { loadRateLimitSettings } from "@/lib/db/queries/rate-limit-settings";
import { checkConfiguredRateLimit } from "@/lib/services/configured-rate-limit";

function guestSafeMessage(cause: unknown, fallback: string): string {
  if (cause instanceof GuestCheckoutError) return cause.message;
  console.error("[booking] checkout action failed:", cause instanceof Error ? cause.message : cause);
  return fallback;
}

async function networkKey(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || store.get("x-real-ip") || "unknown";
  return `quote:ip:${ip}`;
}

export async function quoteGuestBooking(
  raw: unknown,
): Promise<GuestQuoteResult> {
  const parsed = guestQuoteSchema.safeParse(raw);
  if (!parsed.success) return { status: "unpriced", message: QUOTE_REJECTED };

  try {
    const client = await createClient();

    const loaded = await loadPublicBookingSettings(client);
    if (!loaded.ok) {
      console.error("[booking] quote settings unavailable:", loaded.message);
      return { status: "unpriced", message: QUOTE_UNAVAILABLE };
    }

    const limits = await loadRateLimitSettings();
    if (!limits.ok) {
      console.error(
        "[booking] search limits could not be loaded:",
        limits.message,
      );
      return { status: "unpriced", message: QUOTE_UNAVAILABLE };
    }
    const verdict = checkConfiguredRateLimit(
      "availability",
      limits.snapshot,
      await networkKey(),
    );

    if (!verdict.allowed) {
      return { status: "unpriced", message: QUOTE_RATE_LIMITED };
    }

    const feeSettings =
      parsed.data.paymentOption === "tabby" ? await loadGuestFeeSettings() : {};
    const revision = await checkoutRevision();
    const voucher = parsed.data.voucherCode
      ? await guestVoucher(await checkoutToken(false), parsed.data.voucherCode)
      : null;
    const priced = await priceGuestBooking(
      client,
      { ...loaded.snapshot, ...feeSettings },
      parsed.data,
      voucher,
    );
    if (revision !== (await checkoutRevision()))
      return {
        status: "unpriced",
        message: "Prices have just changed. Please check your price again.",
      };
    return priced.status === "priced"
      ? { status: "priced", quote: { ...priced.quote, revision } }
      : priced;
  } catch (cause) {
    console.error("[booking] quoteGuestBooking fault:", cause);
    return { status: "unpriced", message: QUOTE_UNAVAILABLE };
  }
}

export async function releaseGuestBooking(): Promise<{
  ok: boolean;
  message?: string;
}> {
  try {
    const store = await cookies();
    const token = z
      .uuid()
      .safeParse(store.get(GUEST_CHECKOUT.cookieName)?.value);
    if (token.success) await releaseGuestVisit(token.data);
    return { ok: true };
  } catch (cause) {
    console.error("[booking] guest hold release failed:", cause);
    return {
      ok: false,
      message: "Your previous time could not be released. Try again.",
    };
  }
}

async function checkoutToken(create: boolean): Promise<string | null> {
  const store = await cookies();
  const existing = z
    .uuid()
    .safeParse(store.get(GUEST_CHECKOUT.cookieName)?.value);
  if (existing.success) return existing.data;
  if (!create) return null;
  const token = randomUUID();
  store.set(GUEST_CHECKOUT.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_CHECKOUT.cookieMaxAgeSeconds,
  });
  return token;
}

export async function restoreGuestCheckout() {
  const token = await checkoutToken(false);
  return token ? loadCheckoutProgress(token) : null;
}

export async function saveGuestCheckout(
  raw: unknown,
  rawOptions: unknown = {},
): Promise<import("@/lib/config/checkout-flow").CheckoutResult<null>> {
  const { checkoutProgressSchema } = await import("@/lib/config/checkout-flow");
  const parsed = checkoutProgressSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };
  const options = z
    .object({ captureCustomer: z.boolean().optional() })
    .catch({})
    .parse(rawOptions);
  try {
    const limits = await loadRateLimitSettings();
    if (
      !limits.ok ||
      !checkConfiguredRateLimit(
        "availability",
        limits.snapshot,
        `save:${await networkKey()}`,
      ).allowed
    )
      return { ok: false, message: QUOTE_RATE_LIMITED };
    const loaded = await loadPublicBookingSettings(await createClient());
    if (!loaded.ok) throw new Error("Booking settings could not be loaded.");
    const { guestBookingRefusal, guestPartyRefusal } =
      await import("@/lib/services/guest-booking-rules");
    const selection = parsed.data.selection;
    const refusal = (
      selection.startsAt ? guestBookingRefusal : guestPartyRefusal
    )(loaded.snapshot, {
      ...selection,
      startsAt: selection.startsAt ?? new Date().toISOString(),
      dateOfBirth: parsed.data.identity.dateOfBirth,
    });
    if (refusal) return { ok: false, message: refusal };
    const issued = await checkoutToken(true);
    if (issued === null)
      return { ok: false, message: "Your booking session could not be started. Please try again." };
    let token = issued;
    const previous = await loadCheckoutProgress(token);
    if (previous?.receiptToken) {
      token = randomUUID();
      (await cookies()).set(GUEST_CHECKOUT.cookieName, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: GUEST_CHECKOUT.cookieMaxAgeSeconds,
      });
    }
    await saveCheckoutProgress(token, parsed.data, { captureCustomer: options.captureCustomer === true });
    return { ok: true, value: null };
  } catch (cause) {
    return {
      ok: false,
      message: guestSafeMessage(cause, "Your booking progress could not be saved. Please try again."),
    };
  }
}

export async function startGuestPayment(
  raw: unknown,
): Promise<
  | import("@/lib/config/checkout-flow").CheckoutResult<
      import("@/lib/config/checkout-flow").PreparedPayment
    >
  | { ok: false; message: string; timeUnavailable: true }
> {
  const { checkoutPaymentSchema, CHECKOUT_FLOW } = await import("@/lib/config/checkout-flow");
  const { activePaymentProvider } = await import("@/lib/payments");
  const parsed = checkoutPaymentSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };
  const provider = activePaymentProvider();
  if (provider === null)
    return {
      ok: false,
      message:
        "Online payments are not available yet. Please contact WellPlace.",
    };
  const input = parsed.data;
  if (input.selection.startsAt === null)
    return { ok: false, message: "Choose a start time before paying.", timeUnavailable: true };
  const saved = await saveGuestCheckout({
    identity: input.identity,
    selection: input.selection,
    acceptedTerms: true,
    lastCompletedStep: "confirm",
  });
  if (!saved.ok) return saved;
  const result = await quoteGuestBooking({
    ...input.selection,
    dateOfBirth: input.identity.dateOfBirth,
    comparisonDurationsHours: [],
  });
  if (result.status !== "priced") return { ok: false, message: result.message };
  if (result.quote.voucherMessage)
    return { ok: false, message: result.quote.voucherMessage };
  if (
    result.quote.breakdown.totalFils !== input.expectedTotalFils ||
    result.quote.revision !== input.revision
  )
    return {
      ok: false,
      message:
        "Your price has changed. Review the updated total before paying.",
    };
  try {
    const token = await checkoutToken(false);
    if (token === null)
      return { ok: false, message: "Your booking session expired. Please enter your details again." };
    const settings = await loadPublicBookingSettings(await createClient());
    if (!settings.ok)
      return { ok: false, message: "Booking settings could not be loaded. Try again." };
    const held = await holdGuestVisit(
      token,
      {
        startsAt: input.selection.startsAt,
        durationHours: input.selection.durationHours,
        adults: input.selection.adults,
        childAges: input.selection.childAges,
        dateOfBirth: input.identity.dateOfBirth,
      },
      settings.snapshot,
    );
    if (!held.ok)
      return held.chooseAnotherTime
        ? { ok: false, message: held.message, timeUnavailable: true }
        : { ok: false, message: held.message };
    const prepared = await prepareGuestPayment(
      token,
      input.requestId,
      result.quote,
      CHECKOUT_FLOW.currency,
      {
        identity: input.identity,
        selection: input.selection,
        acceptedTerms: true,
        lastCompletedStep: "confirm",
      },
      provider.id === "simulation",
    );
    const started = await provider.startPayment({
      paymentId: prepared.paymentId,
      reference: prepared.paymentId,
      amountFils: prepared.amountFils,
      currency: prepared.currency,
      option: input.selection.paymentOption,
    });
    return { ok: true, value: { ...prepared, redirectUrl: started.redirectUrl } };
  } catch (cause) {
    return {
      ok: false,
      message: guestSafeMessage(cause, "Payment could not be started. Please try again."),
    };
  }
}

export async function finishSimulatedPayment(
  raw: unknown,
): Promise<
  import("@/lib/config/checkout-flow").CheckoutResult<
    import("@/lib/config/checkout-flow").SettledPayment
  >
> {
  const { simulationOutcomeSchema } =
    await import("@/lib/config/checkout-flow");
  const { paymentMode } = await import("@/lib/payments");
  const { signSimulatedEvent } = await import("@/lib/payments/simulated");
  const { handlePaymentCallback } = await import("@/lib/services/payment-callback");
  const parsed = simulationOutcomeSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, message: "Choose a payment result to continue." };
  if (paymentMode() !== "simulation")
    return { ok: false, message: "Online payments are not available yet. Please contact WellPlace." };
  try {
    const token = await checkoutToken(false);
    if (!token)
      return {
        ok: false,
        message: "Your payment session expired. Please contact WellPlace.",
      };
    const payment = await ownedGuestPayment(token, parsed.data.paymentId);
    const delivery = signSimulatedEvent({
      paymentId: payment.paymentId,
      outcome: parsed.data.outcome,
      amountFils: payment.amountFils,
      currency: payment.currency,
    });
    const outcome = await handlePaymentCallback(delivery.rawBody, "simulation", delivery.signature);
    if (outcome.kind === "rejected")
      return { ok: false, message: "Your payment result could not be checked. Please try again." };
    return {
      ok: true,
      value: {
        status: outcome.settlement.status,
        receiptToken: outcome.settlement.receiptToken,
        reference: outcome.settlement.reference,
      },
    };
  } catch (cause) {
    return {
      ok: false,
      message: guestSafeMessage(cause, "Your payment result could not be checked. Please try again."),
    };
  }
}
