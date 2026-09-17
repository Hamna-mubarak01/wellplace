import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/db/admin";
import { settlePaymentEvent, SettlementRefusedError, type Settlement } from "@/lib/db/payment-events";
import type { WellPlaceClient } from "@/lib/db/types";
import { signSimulatedEvent } from "@/lib/payments/simulated";
import type { PaymentEvent } from "@/lib/payments/types";
import { handlePaymentCallback } from "@/lib/services/payment-callback";

vi.mock("@/lib/db/admin", () => ({ createAdminClient: vi.fn() }));

const PAYMENT_ID = "6f1b0c2e-9d4a-4c11-8e21-3a5f7d9b0c41";
const REFUSAL_CODES = ["WP065", "42501"] as const;
const RETRYABLE_CODES = ["40001", "40P01", "57014", "08006", "P0001", "P0002", "WP062", "WP066", "23505", "PGRST301", ""] as const;
const DATABASE_DETAIL = "duplicate key value violates unique constraint payment_events_provider_event_id_key";

const EVENT: PaymentEvent = {
  provider: "simulation",
  providerEventId: "SIM-EVENT-0001",
  paymentId: PAYMENT_ID,
  outcome: "success",
  amountFils: 66000,
  currency: "AED",
  transactionReference: "TXN-ABCDEF",
  payload: { issuedAt: "2040-04-01T05:55:00.000Z" },
};

const SETTLED: Settlement = {
  status: "confirmed",
  duplicate: false,
  receiptToken: "4d3c2b1a-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  reference: "WPTEST01",
  bookingId: "0b7e4f6a-2c3d-4e5f-8a9b-1c2d3e4f5a6b",
  paymentId: PAYMENT_ID,
};

function adminAnswering(response: { readonly data: unknown; readonly error: unknown }) {
  const rpc = vi.fn(async () => response);
  vi.mocked(createAdminClient).mockReturnValue({ rpc } as unknown as WellPlaceClient);
  return rpc;
}

function databaseError(code: string) {
  return { code, message: DATABASE_DETAIL, details: "", hint: "" };
}

async function settlementFailure(): Promise<unknown> {
  return settlePaymentEvent(EVENT).then(
    () => {
      throw new Error("settlePaymentEvent resolved where a failure was expected");
    },
    (cause: unknown) => cause,
  );
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.mocked(createAdminClient).mockReset();
});

describe("[Contract: a booking is paid only after a server-side verified payment-provider event; INV-08] settlePaymentEvent", () => {
  it("calls settle_payment_event once, as verified, with the provider's transaction reference carried in the payload", async () => {
    const rpc = adminAnswering({ data: SETTLED, error: null });

    await expect(settlePaymentEvent(EVENT)).resolves.toEqual(SETTLED);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("settle_payment_event", {
      p_provider: "simulation",
      p_event_id: "SIM-EVENT-0001",
      p_payment_id: PAYMENT_ID,
      p_outcome: "success",
      p_amount_fils: 66000,
      p_currency: "AED",
      p_signature_verified: true,
      p_payload: { issuedAt: "2040-04-01T05:55:00.000Z", transactionReference: "TXN-ABCDEF" },
    });
  });

  it.each(REFUSAL_CODES)("throws SettlementRefusedError carrying %s when the database refuses the result", async (code) => {
    adminAnswering({ data: null, error: databaseError(code) });

    const failure = await settlementFailure();

    expect(failure).toBeInstanceOf(SettlementRefusedError);
    expect(failure).toMatchObject({ name: "SettlementRefusedError", code });
  });

  it.each(RETRYABLE_CODES)(
    "throws a plain Error, not a SettlementRefusedError, for database code %j — and never repeats the database's own message",
    async (code) => {
      adminAnswering({ data: null, error: databaseError(code) });

      const failure = await settlementFailure();

      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(SettlementRefusedError);
      expect(failure).toMatchObject({ message: "The payment result could not be recorded." });
      expect(failure).not.toHaveProperty("code");
      expect(String((failure as Error).message)).not.toContain(DATABASE_DETAIL);
    },
  );

  it("lets a missing service key surface as a plain Error, not a refusal", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set. See .env.example.");
    });

    const failure = await settlementFailure();

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(SettlementRefusedError);
  });
});

describe("[§8; §16.1 a repeated payment webhook causes no duplicate booking, message or payment; INV-09] the callback and the database wrapper agree on what a provider should retry", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2040-04-01T05:55:00.000Z"));
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PAYMENT_MODE", "simulation");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "development");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  function signedSuccess() {
    return signSimulatedEvent({ paymentId: PAYMENT_ID, outcome: "success", amountFils: 66000, currency: "AED" });
  }

  it.each(REFUSAL_CODES)("a database refusal %s reaches the provider as 409 and messages nobody", async (code) => {
    adminAnswering({ data: null, error: databaseError(code) });
    const notify = vi.fn(async () => {});
    const { rawBody, signature } = signedSuccess();

    const outcome = await handlePaymentCallback(rawBody, "simulation", signature, { settle: settlePaymentEvent, notify });

    expect(outcome).toEqual({ kind: "rejected", status: 409, message: "The payment result does not match this payment." });
    expect(notify).not.toHaveBeenCalled();
  });

  it.each(RETRYABLE_CODES)("database code %j reaches the provider as 503, so it delivers the event again", async (code) => {
    adminAnswering({ data: null, error: databaseError(code) });
    const notify = vi.fn(async () => {});
    const { rawBody, signature } = signedSuccess();

    const outcome = await handlePaymentCallback(rawBody, "simulation", signature, { settle: settlePaymentEvent, notify });

    expect(outcome).toEqual({
      kind: "rejected",
      status: 503,
      message: "The payment result could not be recorded. It will be retried.",
    });
    expect(notify).not.toHaveBeenCalled();
  });
});
