export type PaymentOutcome = "success" | "failed" | "cancelled";

export type PaymentProviderId = "simulation";

export interface PaymentRequest {
  readonly paymentId: string;
  readonly reference: string;
  readonly amountFils: number;
  readonly currency: string;
  readonly option: "card" | "tabby";
}

export interface StartedPayment {
  readonly redirectUrl: string | null;
}

export interface PaymentEvent {
  readonly provider: PaymentProviderId;
  readonly providerEventId: string;
  readonly paymentId: string;
  readonly outcome: PaymentOutcome;
  readonly amountFils: number;
  readonly currency: string;
  readonly transactionReference: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface SignedDelivery {
  readonly rawBody: string;
  readonly signature: string;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  startPayment(request: PaymentRequest): Promise<StartedPayment>;
  verifySignature(rawBody: string, signature: string | null): boolean;
  parseEvent(rawBody: string): PaymentEvent;
}

export class PaymentsUnavailableError extends Error {
  constructor(message = "Online payments are not available yet. Please contact WellPlace.") {
    super(message);
    this.name = "PaymentsUnavailableError";
  }
}
