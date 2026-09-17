import { messageFooterDesignSchema } from "@/lib/validation/message-footer";
import { messageHeaderDesignSchema } from "@/lib/validation/message-header";
import { z } from "zod";

import { createAdminClient } from "@/lib/db/admin";
import { queueMessage, recordMessageAttempt } from "@/lib/db/rpc";
import type { WellPlaceClient } from "@/lib/db/types";
import type { PaymentEvent } from "@/lib/payments/types";

export const settlementSchema = z.object({
  status: z.enum(["confirmed", "refunded", "failed", "cancelled", "pending"]),
  duplicate: z.boolean(),
  receiptToken: z.uuid().nullable(),
  reference: z.string(),
  bookingId: z.uuid(),
  paymentId: z.uuid(),
});
export type Settlement = z.infer<typeof settlementSchema>;

export const paymentMessageContextSchema = z.object({
  paymentId: z.uuid(),
  bookingId: z.uuid(),
  customerId: z.uuid(),
  reference: z.string(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  adults: z.number().int().nonnegative(),
  children: z.number().int().nonnegative(),
  amountFils: z.number().int().nonnegative(),
  taxFils: z.number().int().nonnegative(),
  taxLabel: z.string().nullable(),
  simulated: z.boolean(),
  result: z.string().nullable(),
  holdExpiresAt: z.string().nullable(),
  receiptToken: z.uuid().nullable(),
  refundPendingFils: z.number().int().nonnegative(),
  refundSettledFils: z.number().int().nonnegative(),
});
export type PaymentMessageContext = z.infer<typeof paymentMessageContextSchema>;

const SETTLEMENT_REFUSAL_CODES: ReadonlySet<string> = new Set(["WP065", "42501"]);

export class SettlementRefusedError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "SettlementRefusedError";
  }
}

export async function settlePaymentEvent(event: PaymentEvent): Promise<Settlement> {
  const { data, error } = await createAdminClient().rpc("settle_payment_event", {
    p_provider: event.provider,
    p_event_id: event.providerEventId,
    p_payment_id: event.paymentId,
    p_outcome: event.outcome,
    p_amount_fils: event.amountFils,
    p_currency: event.currency,
    p_signature_verified: true,
    p_payload: z.json().parse({ ...event.payload, transactionReference: event.transactionReference }),
  });
  if (error) {
    if (SETTLEMENT_REFUSAL_CODES.has(error.code)) {
      console.error("[payments] settlement refused:", error.code, error.message);
      throw new SettlementRefusedError(error.code, error.message);
    }
    console.error("[payments] settlement could not be recorded, the provider should retry:", error.code || "no code", error.message);
    throw new Error("The payment result could not be recorded.");
  }
  return settlementSchema.parse(data);
}

export async function readPaymentMessageContext(
  client: WellPlaceClient,
  paymentId: string,
): Promise<PaymentMessageContext | null> {
  const { data, error } = await client.rpc("payment_message_context", { p_payment_id: paymentId });
  if (error) {
    console.error("[messages] payment context could not be read:", error.code);
    return null;
  }
  if (data === null) return null;
  const parsed = paymentMessageContextSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[messages] payment context was malformed:", parsed.error.issues[0]?.message);
    return null;
  }
  return parsed.data;
}

const authoredTemplateSchema = z.object({
  footer: z.string().nullable().optional(),
  document_footer: z.string().nullable().optional(),
  footer_design: messageFooterDesignSchema.nullish(),
  document_footer_design: messageFooterDesignSchema.nullish(),
  header_design: messageHeaderDesignSchema.nullish(),
  document_header_design: messageHeaderDesignSchema.nullish(),
  branding: z.boolean().nullable().optional(),
  is_active: z.boolean(),
  subject: z.string().nullable(),
  body: z.string().nullable(),
});

export async function readAuthoredTemplate(client: WellPlaceClient, key: string) {
  const { data, error } = await client
    .from("message_templates")
    .select("is_active,subject,body,footer,footer_design,document_footer_design:document->footerDesign,document_footer:document->footer,branding:document->branding,header_design,document_header_design:document->headerDesign")
    .eq("key", key)
    .eq("channel", "email")
    .maybeSingle();
  if (error) {
    console.error("[messages] template could not be read:", error.code);
    return { outcome: "unknown" as const };
  }
  if (data === null) return { outcome: "absent" as const };
  const parsed = authoredTemplateSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[messages] template", key, "has an unexpected shape; the built-in wording is used:", parsed.error.issues[0]?.message);
    return { outcome: "absent" as const };
  }
  return parsed.data.is_active
    ? { outcome: "active" as const, subject: parsed.data.subject, body: parsed.data.body, footer: parsed.data.document_footer ?? parsed.data.footer, footerDesign: parsed.data.document_footer_design ?? parsed.data.footer_design, headerDesign: parsed.data.document_header_design ?? parsed.data.header_design, branding: parsed.data.branding ?? undefined }
    : { outcome: "inactive" as const };
}

export type GuestMessageChannel = "email" | "whatsapp";

export async function queueGuestMessage(
  client: WellPlaceClient,
  input: {
    templateKey: string;
    bookingId: string;
    customerId: string;
    toAddress: string;
    subject: string;
    body: string;
    channel?: GuestMessageChannel;
  },
): Promise<string | null> {
  const result = await queueMessage(client, { ...input, channel: input.channel ?? "email" });
  if (result.outcome !== "ok") {
    console.error("[messages] could not queue", input.templateKey, input.channel ?? "email", result.outcome);
    return null;
  }
  return result.value.messageId;
}

export async function recordGuestMessageAttempt(
  client: WellPlaceClient,
  input: {
    messageId: string;
    sent: boolean;
    providerMessageId: string | null;
    error: string | null;
    channel?: GuestMessageChannel;
  },
): Promise<void> {
  const result = await recordMessageAttempt(client, {
    messageId: input.messageId,
    status: input.sent ? "sent" : "failed",
    providerMessageId: input.providerMessageId,
    error: input.error,
  });
  if (result.outcome !== "ok") {
    console.error("[messages] could not record the", input.channel ?? "email", "attempt for", input.messageId);
  }
}

export function paymentCallbackClient(): WellPlaceClient {
  return createAdminClient();
}
