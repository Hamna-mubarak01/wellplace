import { describe, expect, it } from "vitest";
import {
  checkoutPaymentSchema,
  checkoutProgressSchema,
} from "@/lib/config/checkout-flow";
import { couponSchema } from "@/lib/config/coupons";
import { priceBooking } from "@/lib/domain/pricing";
import { LAUNCH_PRICE_TIERS } from "@/lib/config/pricing";
import { resolvePaymentMode } from "@/lib/config/payments";
import { signSimulatedEvent, simulatedProvider } from "@/lib/payments/simulated";
const identity = {
  salutation: "mr",
  firstName: "Guest",
  lastName: "Example",
  email: "Guest@example.test",
  dateOfBirth: "1990-01-01",
  phoneE164: "+971500000001",
  phoneCountry: "AE",
};
const progress = {
  identity,
  selection: {
    startsAt: null,
    durationHours: 2,
    adults: 2,
    childAges: [],
    addonQuantities: {},
  },
  acceptedTerms: true,
  lastCompletedStep: "details",
};
describe("[CLIENT Booking offers detail; §6, §8] checkout boundaries", () => {
  it("requires consent and complete lead contact before saving", () => {
    expect(
      checkoutProgressSchema.safeParse({ ...progress, acceptedTerms: false })
        .success,
    ).toBe(false);
    expect(
      checkoutProgressSchema.safeParse({
        ...progress,
        identity: { ...identity, phoneE164: "123" },
      }).success,
    ).toBe(false);
    expect(checkoutProgressSchema.parse(progress).identity.email).toBe(
      "guest@example.test",
    );
  });
  it("refuses negative or fractional fils and unknown payment fields", () => {
    for (const expectedTotalFils of [-1, 1.5])
      expect(
        checkoutPaymentSchema.safeParse({
          ...progress,
          expectedTotalFils,
          revision: "abc",
          requestId: crypto.randomUUID(),
        }).success,
      ).toBe(false);
    expect(
      checkoutProgressSchema.safeParse({
        ...progress,
        identity: { ...identity, cardNumber: "not collected" },
      }).success,
    ).toBe(false);
  });
  it("charges every fifth adult or child and includes VAT exactly once", () => {
    const quote = (adults: number, childAges: number[]) =>
      priceBooking({
        context: {
          isoDate: "2026-09-12",
          weekday: 6,
          startMinutes: 600,
          durationHours: 2,
        },
        tiers: LAUNCH_PRICE_TIERS,
        guests: { adults, childAges },
        addons: [],
        promotion: null,
        serviceFee: null,
        tax: { percent: 5, inclusive: true, label: "VAT" },
        roundingFils: 50,
        manualTotalFils: null,
      });
    expect(quote(2, []).totalFils).toBe(66000);
    expect(quote(5, []).totalFils - quote(4, []).totalFils).toBe(33000);
    expect(quote(4, [8]).totalFils - quote(4, []).totalFils).toBe(25500);
    expect(quote(2, []).netFils + quote(2, []).taxFils).toBe(66000);
  });
  it("[contract: paid only after a server-verified event] resolves to the simulator or to disabled, never to a live acquirer", () => {
    expect(resolvePaymentMode({ PAYMENT_MODE: "simulation" })).toBe("simulation");
    expect(resolvePaymentMode({ PAYMENT_MODE: "disabled" })).toBe("disabled");
    expect(resolvePaymentMode({})).toBe("simulation");
    expect(resolvePaymentMode({ PAYMENT_MODE: "anything-else" })).toBe("simulation");
  });
  it("signs a simulated result that only this server can verify, and reads it only after verification", () => {
    const paymentId = crypto.randomUUID();
    const delivery = signSimulatedEvent({ paymentId, outcome: "success", amountFils: 66000, currency: "AED" });
    expect(simulatedProvider.verifySignature(delivery.rawBody, delivery.signature)).toBe(true);
    expect(simulatedProvider.parseEvent(delivery.rawBody)).toMatchObject({
      provider: "simulation", paymentId, outcome: "success", amountFils: 66000, currency: "AED",
      providerEventId: `SIM-${paymentId}-success`,
    });
    const tampered = delivery.rawBody.replace("66000", "1");
    expect(simulatedProvider.verifySignature(tampered, delivery.signature)).toBe(false);
    expect(simulatedProvider.verifySignature(delivery.rawBody, null)).toBe(false);
    expect(simulatedProvider.verifySignature(delivery.rawBody, "sha256=forged")).toBe(false);
  });
});
describe("[CLIENT coupon request] editable coupon limits", () => {
  const coupon = {
    id: null,
    updatedAt: null,
    code: "WP-EXAMPLE",
    kind: "percent",
    amountFils: null,
    percent: 25,
    addonIds: [],
    validFrom: "2026-09-12",
    validTo: "2026-09-12",
    maxUses: 1,
    perCustomerLimit: 1,
    isCombinable: true,
    isActive: true,
  };
  it("allows a single-day coupon and unlimited expiry/usage", () => {
    expect(couponSchema.safeParse(coupon).success).toBe(true);
    expect(
      couponSchema.safeParse({
        ...coupon,
        validTo: null,
        maxUses: null,
        perCustomerLimit: null,
      }).success,
    ).toBe(true);
  });
  it("rejects reversed dates, zero discounts, fractional usage and percentages over 100", () => {
    for (const patch of [
      { validTo: "2026-09-11" },
      { percent: 0 },
      { percent: 101 },
      { maxUses: 0 },
      { perCustomerLimit: 1.5 },
      { kind: "addon_free", percent: null, addonIds: [] },
    ])
      expect(couponSchema.safeParse({ ...coupon, ...patch }).success).toBe(
        false,
      );
  });
});
