import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { PAYMENT_CALLBACK } from "@/lib/config/payments";
import type {
  PaymentEvent,
  PaymentOutcome,
  PaymentProvider,
  PaymentRequest,
  SignedDelivery,
  StartedPayment,
} from "@/lib/payments/types";

const PROCESS_SECRET = randomBytes(PAYMENT_CALLBACK.simulatorSecretBytes);

const simulatedEventSchema = z
  .object({
    provider: z.literal("simulation"),
    eventId: z.string().min(1).max(PAYMENT_CALLBACK.eventIdMaxLength),
    paymentId: z.uuid(),
    outcome: z.enum(["success", "failed", "cancelled"]),
    amountFils: z.number().int().nonnegative(),
    currency: z.string().length(3),
    issuedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

function digest(rawBody: string): string {
  return `${PAYMENT_CALLBACK.signaturePrefix}${createHmac("sha256", PROCESS_SECRET).update(rawBody).digest("hex")}`;
}

export function signSimulatedEvent(input: {
  paymentId: string;
  outcome: PaymentOutcome;
  amountFils: number;
  currency: string;
}): SignedDelivery {
  const rawBody = JSON.stringify({
    provider: "simulation",
    eventId: `SIM-${input.paymentId}-${input.outcome}`,
    paymentId: input.paymentId,
    outcome: input.outcome,
    amountFils: input.amountFils,
    currency: input.currency,
    issuedAt: new Date().toISOString(),
  });
  return { rawBody, signature: digest(rawBody) };
}

export const simulatedProvider: PaymentProvider = {
  id: "simulation",

  async startPayment(request: PaymentRequest): Promise<StartedPayment> {
    void request;
    return { redirectUrl: null };
  },

  verifySignature(rawBody: string, signature: string | null): boolean {
    if (!signature) return false;
    const expected = Buffer.from(digest(rawBody));
    const received = Buffer.from(signature);
    return expected.length === received.length && timingSafeEqual(expected, received);
  },

  parseEvent(rawBody: string): PaymentEvent {
    const event = simulatedEventSchema.parse(JSON.parse(rawBody));
    return {
      provider: "simulation",
      providerEventId: event.eventId,
      paymentId: event.paymentId,
      outcome: event.outcome,
      amountFils: event.amountFils,
      currency: event.currency,
      transactionReference: null,
      payload: { issuedAt: event.issuedAt, simulated: true },
    };
  },
};
