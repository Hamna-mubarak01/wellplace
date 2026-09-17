import { z } from "zod";

export const PAYMENT_CALLBACK = {
  path: "/api/webhooks/payment",
  signatureHeader: "x-wellplace-signature",
  providerHeader: "x-wellplace-provider",
  signaturePrefix: "sha256=",
  simulatorSecretBytes: 32,
  eventIdMaxLength: 200,
  maxBodyBytes: 16_384,
  rateLimitPerWindow: 120,
  rateLimitWindowMinutes: 1,
} as const;

// This demo ships without a card acquirer. The simulator is the only provider,
// so it is also the default: checkout works out of the box, in every
// environment, and no money ever moves. `disabled` stays available for running
// the site in waitlist mode with the booking flow closed.
export const PAYMENT_MODES = ["simulation", "disabled"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

const paymentModeSchema = z.enum(PAYMENT_MODES);

export interface PaymentEnvironment {
  readonly PAYMENT_MODE?: string;
}

export function resolvePaymentMode(env: PaymentEnvironment): PaymentMode {
  const configured = env.PAYMENT_MODE?.trim();
  if (!configured) return "simulation";
  const requested = paymentModeSchema.safeParse(configured);
  return requested.success ? requested.data : "simulation";
}
