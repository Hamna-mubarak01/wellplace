import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PAYMENT_CALLBACK } from "@/lib/config/payments";
import { SettlementRefusedError, type Settlement } from "@/lib/db/payment-events";
import { signSimulatedEvent, simulatedProvider } from "@/lib/payments/simulated";
import type { PaymentEvent } from "@/lib/payments/types";
import { handlePaymentCallback, type CallbackDependencies } from "@/lib/services/payment-callback";

const PAYMENT_ID = "6f1b0c2e-9d4a-4c11-8e21-3a5f7d9b0c41";
const BOOKING_ID = "0b7e4f6a-2c3d-4e5f-8a9b-1c2d3e4f5a6b";
const RECEIPT_TOKEN = "4d3c2b1a-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const ISSUED_AT = new Date("2040-04-01T05:55:00.000Z");
const AMOUNT_FILS = 66000;

function settlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    status: "confirmed",
    duplicate: false,
    receiptToken: RECEIPT_TOKEN,
    reference: "WPTEST01",
    bookingId: BOOKING_ID,
    paymentId: PAYMENT_ID,
    ...overrides,
  };
}

function recordingDependencies(result: () => Promise<Settlement> = async () => settlement()) {
  const settled: PaymentEvent[] = [];
  const notified: Settlement[] = [];
  const settle = vi.fn(async (event: PaymentEvent) => {
    settled.push(event);
    return result();
  });
  const notify = vi.fn(async (value: Settlement) => {
    notified.push(value);
  });
  const dependencies: CallbackDependencies = { settle, notify };
  return { dependencies, settle, notify, settled, notified };
}

function signedSuccess() {
  return signSimulatedEvent({
    paymentId: PAYMENT_ID,
    outcome: "success",
    amountFils: AMOUNT_FILS,
    currency: "AED",
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(ISSUED_AT);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("PAYMENT_MODE", "simulation");
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_APP_ENV", "development");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("[§3, §8; INV-08] a payment is paid only after a signature-verified provider event", () => {
  it("rejects an unverified signature with 401 before the body is read or settled", async () => {
    const parse = vi.spyOn(simulatedProvider, "parseEvent");
    const { dependencies, settle, notify } = recordingDependencies();

    const outcome = await handlePaymentCallback("{not json", "simulation", "sha256=forged", dependencies);

    expect(outcome).toEqual({
      kind: "rejected",
      status: 401,
      message: "The payment callback could not be verified.",
    });
    expect(parse).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("rejects a missing signature with 401", async () => {
    const { rawBody } = signedSuccess();
    const { dependencies, settle } = recordingDependencies();

    const outcome = await handlePaymentCallback(rawBody, "simulation", null, dependencies);

    expect(outcome).toMatchObject({ kind: "rejected", status: 401 });
    expect(settle).not.toHaveBeenCalled();
  });

  it("rejects a tampered body carrying the original signature with 401", async () => {
    const { rawBody, signature } = signedSuccess();
    const tampered = rawBody.replace(`"amountFils":${AMOUNT_FILS}`, '"amountFils":1');
    expect(tampered).not.toBe(rawBody);
    const { dependencies, settle } = recordingDependencies();

    const outcome = await handlePaymentCallback(tampered, "simulation", signature, dependencies);

    expect(outcome).toMatchObject({ kind: "rejected", status: 401 });
    expect(settle).not.toHaveBeenCalled();
  });

  it("answers 503 when payments are disabled, so a deployment with checkout closed never accepts an event", async () => {
    vi.stubEnv("PAYMENT_MODE", "disabled");
    const { rawBody, signature } = signedSuccess();
    const { dependencies, settle } = recordingDependencies();

    const outcome = await handlePaymentCallback(rawBody, "simulation", signature, dependencies);

    expect(outcome).toEqual({
      kind: "rejected",
      status: 503,
      message: "This payment provider is not enabled.",
    });
    expect(settle).not.toHaveBeenCalled();
  });

  it("answers 503 for a provider id that is not the enabled provider", async () => {
    const { rawBody, signature } = signedSuccess();
    const { dependencies, settle } = recordingDependencies();

    const outcome = await handlePaymentCallback(rawBody, "unknown-provider", signature, dependencies);

    expect(outcome).toMatchObject({ kind: "rejected", status: 503 });
    expect(settle).not.toHaveBeenCalled();
  });

  it("answers 413 for a body over the byte limit, counting bytes rather than characters", async () => {
    const { dependencies, settle } = recordingDependencies();
    const overInCharacters = "x".repeat(PAYMENT_CALLBACK.maxBodyBytes + 1);
    const overOnlyInBytes = "é".repeat(PAYMENT_CALLBACK.maxBodyBytes / 2 + 1);
    expect(overOnlyInBytes.length).toBeLessThan(PAYMENT_CALLBACK.maxBodyBytes);

    expect(await handlePaymentCallback(overInCharacters, "simulation", null, dependencies)).toEqual({
      kind: "rejected",
      status: 413,
      message: "The payment callback is too large.",
    });
    expect(await handlePaymentCallback(overOnlyInBytes, "simulation", null, dependencies)).toMatchObject({
      kind: "rejected",
      status: 413,
    });
    expect(
      await handlePaymentCallback("x".repeat(PAYMENT_CALLBACK.maxBodyBytes), "simulation", null, dependencies),
    ).toMatchObject({ kind: "rejected", status: 401 });
    expect(settle).not.toHaveBeenCalled();
  });

  it("answers 413 before it resolves the provider, verifies a signature or reads the body", async () => {
    const verify = vi.spyOn(simulatedProvider, "verifySignature");
    const parse = vi.spyOn(simulatedProvider, "parseEvent");
    const { dependencies, settle, notify } = recordingDependencies();
    const oversize = "x".repeat(PAYMENT_CALLBACK.maxBodyBytes + 1);
    const { signature } = signedSuccess();
    const tooLarge = { kind: "rejected", status: 413, message: "The payment callback is too large." };

    const withSignature = await handlePaymentCallback(oversize, "simulation", signature, dependencies);
    const fromProviderNotEnabled = await handlePaymentCallback(oversize, "unknown-provider", signature, dependencies);
    const withNoProviderOrSignature = await handlePaymentCallback(oversize, null, null, dependencies);
    vi.stubEnv("PAYMENT_MODE", "disabled");
    const whilePaymentsAreDisabled = await handlePaymentCallback(oversize, "simulation", signature, dependencies);

    expect([withSignature, fromProviderNotEnabled, withNoProviderOrSignature, whilePaymentsAreDisabled]).toEqual([
      tooLarge,
      tooLarge,
      tooLarge,
      tooLarge,
    ]);
    expect(verify).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("settles a valid signed event exactly once and notifies the guest exactly once", async () => {
    const { rawBody, signature } = signedSuccess();
    const { dependencies, settle, notify, settled, notified } = recordingDependencies();

    const outcome = await handlePaymentCallback(rawBody, "simulation", signature, dependencies);

    expect(outcome).toEqual({ kind: "settled", settlement: settlement() });
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settled[0]).toEqual({
      provider: "simulation",
      providerEventId: `SIM-${PAYMENT_ID}-success`,
      paymentId: PAYMENT_ID,
      outcome: "success",
      amountFils: AMOUNT_FILS,
      currency: "AED",
      transactionReference: null,
      payload: { issuedAt: ISSUED_AT.toISOString(), simulated: true },
    });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notified).toEqual([settlement()]);
  });
});

describe("[§8; §16.1 a repeated payment webhook causes no duplicate booking, message or payment; INV-09]", () => {
  it("does not message the guest again when the settlement reports a duplicate", async () => {
    const { rawBody, signature } = signedSuccess();
    const duplicate = settlement({ duplicate: true });
    const { dependencies, settle, notify } = recordingDependencies(async () => duplicate);

    const outcome = await handlePaymentCallback(rawBody, "simulation", signature, dependencies);

    expect(outcome).toEqual({ kind: "settled", settlement: duplicate });
    expect(settle).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it("delivering the same signed event twice messages the guest once when the second settlement is a duplicate", async () => {
    const { rawBody, signature } = signedSuccess();
    const results = [settlement(), settlement({ duplicate: true })];
    const { dependencies, notify } = recordingDependencies(async () => {
      const next = results.shift();
      if (next === undefined) throw new Error("settled more than twice");
      return next;
    });

    await handlePaymentCallback(rawBody, "simulation", signature, dependencies);
    await handlePaymentCallback(rawBody, "simulation", signature, dependencies);

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("answers 409 when the database refuses the result, and messages nobody", async () => {
    const { rawBody, signature } = signedSuccess();
    const { dependencies, notify } = recordingDependencies(async () => {
      throw new SettlementRefusedError("WP065", "The payment result could not be verified.");
    });

    const outcome = await handlePaymentCallback(rawBody, "simulation", signature, dependencies);

    expect(outcome).toEqual({
      kind: "rejected",
      status: 409,
      message: "The payment result does not match this payment.",
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it("answers 503 on an unexpected settlement failure, so the provider delivers again", async () => {
    const { rawBody, signature } = signedSuccess();
    const { dependencies, notify } = recordingDependencies(async () => {
      throw new Error("connection reset");
    });

    const outcome = await handlePaymentCallback(rawBody, "simulation", signature, dependencies);

    expect(outcome).toMatchObject({ kind: "rejected", status: 503 });
    expect(notify).not.toHaveBeenCalled();
  });

  it("answers 409 for a refusal carrying 42501 as well, and messages nobody", async () => {
    const { rawBody, signature } = signedSuccess();
    const { dependencies, notify } = recordingDependencies(async () => {
      throw new SettlementRefusedError("42501", "Payment results are accepted only from the payment callback.");
    });

    const outcome = await handlePaymentCallback(rawBody, "simulation", signature, dependencies);

    expect(outcome).toEqual({
      kind: "rejected",
      status: 409,
      message: "The payment result does not match this payment.",
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it.each([
    ["a TypeError from the network", new TypeError("fetch failed")],
    ["an Error carrying a refusal code without being a refusal", Object.assign(new Error("permission denied"), { code: "42501" })],
    ["a plain object shaped like a refusal", { name: "SettlementRefusedError", code: "WP065", message: "refused" }],
    ["a thrown string", "connection reset"],
    ["undefined", undefined],
  ])("answers 503 for %s, so the provider delivers again, and messages nobody", async (_label, thrown) => {
    const { rawBody, signature } = signedSuccess();
    const { dependencies, settle, notify } = recordingDependencies(async () => {
      throw thrown;
    });

    const outcome = await handlePaymentCallback(rawBody, "simulation", signature, dependencies);

    expect(outcome).toEqual({
      kind: "rejected",
      status: 503,
      message: "The payment result could not be recorded. It will be retried.",
    });
    expect(settle).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it.each(["confirmed", "refunded", "failed", "cancelled", "pending"] as const)(
    "passes a first %s settlement to notify once and never passes its duplicate",
    async (status) => {
      const { rawBody, signature } = signedSuccess();
      const results = [settlement({ status }), settlement({ status, duplicate: true })];
      const { dependencies, notify, notified } = recordingDependencies(async () => {
        const next = results.shift();
        if (next === undefined) throw new Error("settled more than twice");
        return next;
      });

      await handlePaymentCallback(rawBody, "simulation", signature, dependencies);
      await handlePaymentCallback(rawBody, "simulation", signature, dependencies);

      expect(notify).toHaveBeenCalledTimes(1);
      expect(notified).toEqual([settlement({ status })]);
    },
  );

  it("keeps the settled outcome when the guest message fails", async () => {
    const { rawBody, signature } = signedSuccess();
    const { dependencies, notify } = recordingDependencies();
    notify.mockRejectedValueOnce(new Error("mail provider down"));

    const outcome = await handlePaymentCallback(rawBody, "simulation", signature, dependencies);

    expect(outcome).toEqual({ kind: "settled", settlement: settlement() });
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
