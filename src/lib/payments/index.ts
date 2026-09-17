import { resolvePaymentMode, type PaymentMode } from "@/lib/config/payments";
import { simulatedProvider } from "@/lib/payments/simulated";
import type { PaymentProvider, PaymentProviderId } from "@/lib/payments/types";

export function paymentMode(): PaymentMode {
  return resolvePaymentMode({ PAYMENT_MODE: process.env.PAYMENT_MODE });
}

export function activePaymentProvider(): PaymentProvider | null {
  return paymentMode() === "simulation" ? simulatedProvider : null;
}

export function acceptedProvider(id: string | null): PaymentProvider | null {
  const active = activePaymentProvider();
  return active !== null && active.id === (id as PaymentProviderId | null) ? active : null;
}
