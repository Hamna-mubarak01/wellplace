import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireManagement } from "@/lib/auth/session";
import { requireSetting } from "@/lib/config";
import { createClient } from "@/lib/db/server";
import { findBooking } from "@/lib/db/queries/bookings";
import { listBookingRefundRecords } from "@/lib/db/queries/bookings-page";
import { listBookingPayments } from "@/lib/db/queries/payments";
import { loadSettingsSnapshot } from "@/lib/db/queries/settings";
import { idSchema } from "@/lib/validation/console-inputs";
import { ConsolePage } from "@/components/console/console-page";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { BookingReceipt } from "@/components/console/manage/bookings/booking-receipt";
import { BookingReceiptActions } from "@/components/console/manage/bookings/booking-receipt-actions";
import { ReceiptPrintStyles } from "@/components/console/manage/bookings/receipt-print-styles";
import { ReceiptPrintTheme } from "@/components/console/manage/bookings/receipt-print-theme";
import { buildBookingReceipt } from "@/components/console/manage/bookings/receipt-model";

export const metadata: Metadata = {
  title: "Receipt",
  robots: { index: false, follow: false },
};

export default async function ManageBookingReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManagement();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [lookup, snapshot, payments, refunds] = await Promise.all([
    findBooking(supabase, id),
    loadSettingsSnapshot(supabase),
    listBookingPayments(supabase, id),
    listBookingRefundRecords(supabase, id),
  ]);

  if (lookup.outcome === "not_found") notFound();

  const bookingHref = `/manage/bookings/${id}`;

  if (lookup.outcome === "failed" || !payments.ok || !refunds.ok) {
    const message =
      lookup.outcome === "failed"
        ? "The booking details could not be read just now."
        : !payments.ok
          ? payments.message
          : refunds.ok
            ? ""
            : refunds.message;
    return (
      <ConsolePage title="Receipt" backHref={bookingHref} backLabel="Back to booking">
        <ConsoleReadError
          title="The receipt could not be prepared"
          message={message}
          meaning="A receipt is only shown when every payment and refund on the booking can be read."
          remedy="Reload the page. If it keeps happening, open the booking again."
        />
      </ConsolePage>
    );
  }

  const receipt = buildBookingReceipt({
    booking: lookup.booking,
    payments: payments.payments,
    refunds: refunds.refunds,
    taxLabel: requireSetting(snapshot, "tax.label"),
    taxIsIncluded: requireSetting(snapshot, "tax.inclusive"),
    issuedAt: new Date(),
  });

  return (
    <ConsolePage
      title={`Receipt ${receipt.reference}`}
      backHref={bookingHref}
      backLabel="Back to booking"
      actions={<BookingReceiptActions downloadHref={`/api/console/bookings/${id}/receipt`} />}
    >
      <ReceiptPrintStyles />
      <ReceiptPrintTheme />
      <BookingReceipt receipt={receipt} />
    </ConsolePage>
  );
}
