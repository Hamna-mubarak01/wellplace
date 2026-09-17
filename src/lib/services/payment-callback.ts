import { PAYMENT_CALLBACK } from "@/lib/config/payments";
import {
  paymentCallbackClient,
  settlePaymentEvent,
  SettlementRefusedError,
  type Settlement,
} from "@/lib/db/payment-events";
import { acceptedProvider } from "@/lib/payments";
import type { PaymentEvent } from "@/lib/payments/types";
import { sendBookingMessage } from "@/lib/services/booking-notifications";

export type CallbackOutcome =
  | { readonly kind: "settled"; readonly settlement: Settlement }
  | { readonly kind: "rejected"; readonly status: 400 | 401 | 409 | 413 | 503; readonly message: string };

export interface CallbackDependencies {
  readonly settle: (event: PaymentEvent) => Promise<Settlement>;
  readonly notify: (settlement: Settlement) => Promise<void>;
}

async function notifyGuest(settlement: Settlement): Promise<void> {
  const client = paymentCallbackClient();
  if (settlement.status === "confirmed") {
    await sendBookingMessage("booking_confirmation", settlement.paymentId, client);
  } else if (settlement.status === "refunded") {
    await sendBookingMessage("refund_issued", settlement.paymentId, client, { recovery: true });
  } else if (settlement.status === "failed" || settlement.status === "cancelled") {
    await sendBookingMessage("payment_failed", settlement.paymentId, client);
  }
}

const DEFAULT_DEPENDENCIES: CallbackDependencies = { settle: settlePaymentEvent, notify: notifyGuest };

export async function handlePaymentCallback(
  rawBody: string,
  providerId: string | null,
  signature: string | null,
  dependencies: CallbackDependencies = DEFAULT_DEPENDENCIES,
): Promise<CallbackOutcome> {
  if (Buffer.byteLength(rawBody, "utf8") > PAYMENT_CALLBACK.maxBodyBytes) {
    console.warn("[payments] callback rejected: body over", PAYMENT_CALLBACK.maxBodyBytes, "bytes");
    return { kind: "rejected", status: 413, message: "The payment callback is too large." };
  }

  const provider = acceptedProvider(providerId);
  if (provider === null) {
    console.warn("[payments] callback from a provider that is not enabled:", providerId);
    return { kind: "rejected", status: 503, message: "This payment provider is not enabled." };
  }

  if (!provider.verifySignature(rawBody, signature)) {
    console.warn("[payments] callback rejected: signature did not verify for", provider.id);
    return { kind: "rejected", status: 401, message: "The payment callback could not be verified." };
  }

  let event: PaymentEvent;
  try {
    event = provider.parseEvent(rawBody);
  } catch (cause) {
    console.error("[payments] verified callback could not be read:", cause instanceof Error ? cause.message : cause);
    return { kind: "rejected", status: 400, message: "The payment callback could not be read." };
  }

  let settlement: Settlement;
  try {
    settlement = await dependencies.settle(event);
  } catch (cause) {
    if (cause instanceof SettlementRefusedError) {
      return { kind: "rejected", status: 409, message: "The payment result does not match this payment." };
    }
    console.error("[payments] settlement failed:", cause instanceof Error ? cause.message : cause);
    return { kind: "rejected", status: 503, message: "The payment result could not be recorded. It will be retried." };
  }

  if (!settlement.duplicate) {
    try {
      await dependencies.notify(settlement);
    } catch (cause) {
      console.error("[payments] guest notification failed:", cause instanceof Error ? cause.message : cause);
    }
  }
  return { kind: "settled", settlement };
}
