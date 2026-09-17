import { z } from "zod";
import type { WellPlaceClient } from "@/lib/db/types";

export type RefundMutation = { ok: true } | { ok: false; message: string };

const settledSchema = z.array(z.object({ refund_id: z.uuid(), settled_at: z.string().nullable() }));

export async function withdrawRefundRequest(
  client: WellPlaceClient,
  input: { refundId: string; reason: string },
): Promise<RefundMutation> {
  const { error } = await client.rpc("withdraw_refund_request", { p_refund_id: input.refundId, p_reason: input.reason });
  if (!error) return { ok: true };
  console.error("[refunds] withdraw failed:", error.code);
  return {
    ok: false,
    message: error.code === "WP066" ? error.message : "The refund request could not be withdrawn. Refresh the booking and try again.",
  };
}

export async function revokeReceiptLink(
  client: WellPlaceClient,
  input: { bookingId: string; reason: string },
): Promise<RefundMutation> {
  const { error } = await client.rpc("revoke_receipt_link", { p_booking_id: input.bookingId, p_reason: input.reason });
  if (!error) return { ok: true };
  console.error("[receipt] revoke failed:", error.code);
  return {
    ok: false,
    message: error.code === "P0002" ? "This booking has no active receipt link." : "The receipt link could not be withdrawn. Try again.",
  };
}

export async function isRefundSettled(client: WellPlaceClient, bookingId: string, refundId: string): Promise<boolean> {
  const { data, error } = await client.rpc("booking_refunds", { p_booking_id: bookingId });
  if (error) {
    console.error("[refunds] settlement check failed:", error.code);
    return false;
  }
  const parsed = settledSchema.safeParse(data);
  return parsed.success && parsed.data.some((refund) => refund.refund_id === refundId && refund.settled_at !== null);
}

const refundRowSchema = z.array(
  z.object({ refund_id: z.uuid(), payment_id: z.uuid(), amount_fils: z.number().int().nonnegative() }),
);

export async function refundForMessage(
  client: WellPlaceClient,
  bookingId: string,
  refundId: string,
): Promise<{ paymentId: string; amountFils: number } | null> {
  const { data, error } = await client.rpc("booking_refunds", { p_booking_id: bookingId });
  if (error) {
    console.error("[refunds] refund lookup failed:", error.code);
    return null;
  }
  const parsed = refundRowSchema.safeParse(data);
  const row = parsed.success ? parsed.data.find((refund) => refund.refund_id === refundId) : undefined;
  return row ? { paymentId: row.payment_id, amountFils: row.amount_fils } : null;
}
