"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireManagement } from "@/lib/auth/session";
import { FINANCE_PATH } from "@/lib/config/finance";
import { createClient } from "@/lib/db/server";
import { confirmRefundReturn } from "@/lib/db/rpc";
import { refundForMessage } from "@/lib/db/refunds";
import { ACTION_UNCONFIRMED } from "@/lib/domain/action-errors";
import { sendBookingMessage } from "@/lib/services/booking-notifications";
import { idSchema } from "@/lib/validation/console-inputs";
import { reasonSchema } from "@/lib/validation/audit-reason";
import { paymentReferenceInput } from "@/lib/validation/reception-action-inputs";

export type FinanceActionResult = { ok: true } | { ok: false; message: string };

const confirmReturnSchema = z.object({
  refundId: idSchema,
  reference: paymentReferenceInput.min(1, "Enter the refund transaction or receipt reference."),
  reason: reasonSchema,
  returned: z.literal(true, {
    error: "Confirm that the money has already been returned before updating this record.",
  }),
});

export async function confirmReturnedRefund(input: unknown): Promise<FinanceActionResult> {
  await requireManagement();
  const parsed = confirmReturnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  try {
    const client = await createClient();
    const result = await confirmRefundReturn(client, {
      refundId: parsed.data.refundId,
      reference: parsed.data.reference,
      reason: parsed.data.reason,
    });
    if (result.outcome === "no_suite") {
      return { ok: false, message: "The refund confirmation could not be read. Reload the page before trying again." };
    }
    if (result.outcome !== "ok") return { ok: false, message: result.message };

    const refund = await refundForMessage(client, result.value.bookingId, parsed.data.refundId);
    if (refund !== null) {
      await sendBookingMessage("refund_issued", refund.paymentId, client, { refundFils: refund.amountFils });
    }

    revalidatePath(FINANCE_PATH.root, "layout");
    revalidatePath("/manage/bookings", "layout");
    revalidatePath("/manage/customers", "layout");
    revalidatePath("/reception", "layout");
    return { ok: true };
  } catch (cause) {
    console.error("[finance] confirming a returned refund failed:", cause instanceof Error ? cause.message : cause);
    return { ok: false, message: ACTION_UNCONFIRMED };
  }
}
