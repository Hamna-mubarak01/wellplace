"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { refundPaymentAndCancelBooking, requestPaymentRefund } from "@/lib/db/coupons";
import { isRefundSettled, revokeReceiptLink, withdrawRefundRequest } from "@/lib/db/refunds";
import { sendBookingMessage } from "@/lib/services/booking-notifications";
import {
  CONSOLE_MONEY_AED,
  REASON_MAX_LENGTH,
} from "@/lib/config/console-limits";
import type { BookingActionResult } from "@/app/(console)/reception/actions";
const refundSchema = z.object({
  requestKey: z.uuid(),
  bookingId: z.uuid(),
  paymentId: z.uuid(),
  amountFils: z
    .number()
    .int()
    .positive()
    .max(CONSOLE_MONEY_AED.max * 100),
  reason: z.string().trim().min(1).max(REASON_MAX_LENGTH),
  cancelBooking: z.boolean().default(false),
});

export type RefundActionResult =
  | { ok: true; bookingCancelled: boolean }
  | { ok: false; message: string };

export async function recordRefund(input: {
  bookingId: string;
  paymentId: string;
  amountFils: number;
  reason: string;
  requestKey: string;
  cancelBooking?: boolean;
}): Promise<RefundActionResult> {
  await requireStaff();

  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const refund = {
    requestKey: parsed.data.requestKey,
    paymentId: parsed.data.paymentId,
    amountFils: parsed.data.amountFils,
    reason: parsed.data.reason,
  };
  const result = parsed.data.cancelBooking
    ? await refundPaymentAndCancelBooking(supabase, refund)
    : await requestPaymentRefund(supabase, refund);

  if (result.ok) {
    if (result.refundId !== null && (await isRefundSettled(supabase, parsed.data.bookingId, result.refundId))) {
      await sendBookingMessage("refund_issued", parsed.data.paymentId, supabase, { refundFils: parsed.data.amountFils });
    }
    revalidatePath(`/reception/bookings/${input.bookingId}`);
    revalidatePath(`/manage/bookings/${input.bookingId}`);
    revalidatePath("/manage/finance/payments");
    revalidatePath("/manage/finance/refunds");
    if (result.bookingCancelled) {
      revalidatePath("/reception");
      revalidatePath("/reception/bookings");
      revalidatePath("/manage/bookings");
    }
    return { ok: true, bookingCancelled: result.bookingCancelled };
  }
  return result;
}

const withdrawSchema = z.object({
  bookingId: z.uuid(),
  refundId: z.uuid(),
  reason: z.string().trim().min(1, "Enter a reason for withdrawing this refund.").max(REASON_MAX_LENGTH),
});

export async function withdrawRefund(input: {
  bookingId: string;
  refundId: string;
  reason: string;
}): Promise<BookingActionResult> {
  await requireStaff();
  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const result = await withdrawRefundRequest(await createClient(), {
    refundId: parsed.data.refundId,
    reason: parsed.data.reason,
  });
  if (result.ok) {
    revalidatePath(`/reception/bookings/${parsed.data.bookingId}`);
    revalidatePath(`/manage/bookings/${parsed.data.bookingId}`);
    revalidatePath("/manage/finance/payments");
    revalidatePath("/manage/finance/refunds");
  }
  return result;
}

const revokeSchema = z.object({
  bookingId: z.uuid(),
  reason: z.string().trim().min(1, "Enter a reason for withdrawing the receipt link.").max(REASON_MAX_LENGTH),
});

export async function revokeReceipt(input: { bookingId: string; reason: string }): Promise<BookingActionResult> {
  await requireStaff();
  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const result = await revokeReceiptLink(await createClient(), parsed.data);
  if (result.ok) {
    revalidatePath(`/reception/bookings/${parsed.data.bookingId}`);
    revalidatePath(`/manage/bookings/${parsed.data.bookingId}`);
  }
  return result;
}
