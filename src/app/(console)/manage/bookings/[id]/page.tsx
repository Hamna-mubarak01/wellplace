import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";

import { requireManagement } from "@/lib/auth/session";
import { requireSetting } from "@/lib/config";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import { createClient } from "@/lib/db/server";
import { findBooking } from "@/lib/db/queries/bookings";
import { readBookingAudit } from "@/lib/db/queries/booking-activity";
import { listBookingDocuments, listMissingInvoices } from "@/lib/db/queries/invoices";
import { readBookingMoveOptions } from "@/lib/db/queries/management-bookings";
import { listBookingMessages } from "@/lib/db/queries/operations";
import { listBookingPayments } from "@/lib/db/queries/payments";
import { loadSettingsSnapshot } from "@/lib/db/queries/settings";
import { listBookingRefundRecords, readBookingLedger } from "@/lib/db/queries/bookings-page";
import { formatDubaiDateTime, formatDubaiTime } from "@/lib/domain/time";
import { idSchema } from "@/lib/validation/console-inputs";
import { ConsolePage } from "@/components/console/console-page";
import { ConsoleNotice } from "@/components/console/console-surface";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { DetailTabs } from "@/components/console/shared/detail-tabs";
import { StatusChip } from "@/components/console/shared/status-chip";
import { BookingStatusChip } from "@/components/console/manage/bookings/booking-status-chip";
import { PaymentStatusChip } from "@/components/console/manage/bookings/payment-status-chip";
import { BookingPageActions } from "@/components/console/manage/bookings/booking-page-actions";
import { CopyReferenceAction } from "@/components/console/manage/bookings/copy-reference-action";
import { BookingSummaryCard } from "@/components/console/manage/bookings/booking-summary-card";
import { BookingVisitSection } from "@/components/console/manage/bookings/booking-visit-section";
import { BookingCustomerSection } from "@/components/console/manage/bookings/booking-customer-section";
import { BookingNotesSection } from "@/components/console/manage/bookings/booking-notes-section";
import { BookingNotesEditAction } from "@/components/console/manage/bookings/booking-notes-edit-action";
import { BookingPaymentsSection } from "@/components/console/manage/bookings/booking-payments-section";
import { BookingRefundsSection } from "@/components/console/manage/bookings/booking-refunds-section";
import { BookingInvoicesSection } from "@/components/console/manage/bookings/booking-invoices-section";
import { IssueInvoiceButton } from "@/components/console/manage/finance/issue-invoice-button";
import { BookingMessagesSection } from "@/components/console/manage/bookings/booking-messages-section";
import { BookingHistorySection } from "@/components/console/manage/bookings/booking-history-section";
import {
  bookingActionGates,
  bookingStatusLabel,
  durationLabel,
  guestsLabel,
  moneySummary,
  priceRows,
  resolveDisplayStatus,
  suiteLabel,
  visitMinutes,
} from "@/components/console/manage/bookings/booking-model";
import { suitePath } from "@/app/(console)/manage/suites/suites-view";

export const metadata: Metadata = {
  title: "Booking",
  robots: { index: false, follow: false },
};

const META_LINK =
  "rounded-(--radius-inner) text-text-primary underline-offset-4 outline-none hover:text-brand hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring";

export default async function ManageBookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManagement();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const bookingLookup = findBooking(supabase, id);
  const [lookup, snapshot, ledger, payments, refunds, documents, messages, history, moveOptions, missing] = await Promise.all([
    bookingLookup,
    loadSettingsSnapshot(supabase),
    readBookingLedger(supabase, id),
    listBookingPayments(supabase, id, true),
    listBookingRefundRecords(supabase, id),
    listBookingDocuments(supabase, id),
    listBookingMessages(supabase, id),
    readBookingAudit(supabase, id),
    readBookingMoveOptions(supabase, id),
    bookingLookup.then((found) =>
      found.outcome === "found"
        ? listMissingInvoices(supabase, {
            search: found.booking.reference,
            page: 1,
            pageSize: MANAGEMENT_LIST.bookingInvoicesLimit,
          })
        : null,
    ),
  ]);

  if (lookup.outcome === "not_found") notFound();

  if (lookup.outcome === "failed") {
    return (
      <ConsolePage title="Booking" backHref="/manage/bookings" backLabel="Back to bookings">
        <ConsoleReadError
          title="This booking could not be loaded"
          message="The booking details could not be read just now."
          meaning="This is not the same as the booking not existing."
          remedy="Reload the page. If it keeps happening, open the booking again from the list."
        />
      </ConsolePage>
    );
  }

  const booking = lookup.booking;
  const taxLabel = requireSetting(snapshot, "tax.label");
  const taxIsIncluded = requireSetting(snapshot, "tax.inclusive");
  const minutes = visitMinutes(booking.startsAt, booking.endsAt);
  const displayStatus = resolveDisplayStatus(booking.status, booking.displayStatus);

  const gates = bookingActionGates({
    status: booking.status,
    suiteId: booking.suiteId,
    otherSuites: moveOptions.ok ? moveOptions.suites.filter((suite) => !suite.isCurrent).length : null,
  });

  const money = ledger.ok
    ? moneySummary({
        status: booking.status,
        totalFils: booking.totalFils,
        overrunFils: booking.overrunFils,
        paidFils: ledger.ledger.paidFils,
        refundedFils: ledger.ledger.refundedFils,
        refundsPendingFils: ledger.ledger.refundsPendingFils,
        isComplimentary: booking.isComplimentary,
      })
    : null;

  const rows = priceRows({
    subtotalFils: booking.subtotalFils,
    discountFils: booking.discountFils,
    addonsFils: booking.addonsFils,
    serviceFeeFils: booking.serviceFeeFils,
    taxFils: booking.taxFils,
    totalFils: booking.totalFils,
    overrunFils: booking.overrunFils,
    overrunMinutes: booking.overrunMinutes,
    addons: booking.addons,
    visitLabel: `${durationLabel(minutes)} · ${guestsLabel(booking.adults, booking.children)}`,
    taxLabel,
    taxIsIncluded,
  });

  const customerHref = booking.customerId === "" ? null : `/manage/customers/${booking.customerId}`;
  const missingInvoice = missing?.ok === true && missing.rows.some((row) => row.bookingId === booking.id);
  const missingCheckFailed = missing !== null && !missing.ok;

  return (
    <ConsolePage
      title={booking.reference}
      titleAction={<CopyReferenceAction reference={booking.reference} />}
      backHref="/manage/bookings"
      backLabel="Back to bookings"
      meta={[
        customerHref === null ? (
          booking.guestName || "Name not recorded"
        ) : (
          <Link key="customer" href={customerHref} className={META_LINK}>
            {booking.guestName || "Name not recorded"}
          </Link>
        ),
        booking.suiteId === null ? (
          <span key="suite" className="text-warning-ink">No suite secured</span>
        ) : (
          <Link key="suite" href={suitePath(booking.suiteId)} className={`${META_LINK} font-data tabular-nums`}>
            {suiteLabel(booking.suiteNumber)}
          </Link>
        ),
        <span key="visit" className="font-data tabular-nums">
          {formatDubaiDateTime(booking.startsAt)}–{formatDubaiTime(booking.endsAt)}
        </span>,
      ]}
      status={
        <>
          <BookingStatusChip status={displayStatus} />
          {booking.isComplimentary ? (
            <StatusChip tone="brand">Complimentary</StatusChip>
          ) : ledger.ok ? (
            <PaymentStatusChip status={ledger.ledger.paymentStatus} />
          ) : null}
        </>
      }
      actions={
        <BookingPageActions
          booking={{
            id: booking.id,
            reference: booking.reference,
            status: booking.status,
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
            suiteId: booking.suiteId,
            suiteNumber: booking.suiteNumber,
            guestName: booking.guestName,
          }}
          gates={gates}
          suites={
            moveOptions.ok
              ? moveOptions.suites.map((suite) => ({
                  id: suite.suiteId,
                  suiteNumber: suite.suiteNumber,
                  status: suite.status,
                  isCurrent: suite.isCurrent,
                  isAvailable: suite.isAvailable,
                }))
              : []
          }
          settings={{
            defaultExtensionMinutes: requireSetting(snapshot, "reception.default_extension_minutes"),
            maxHorizonDays: requireSetting(snapshot, "booking.max_horizon_days"),
            durationsHours: requireSetting(snapshot, "booking.durations_hours"),
          }}
          receiptHref={`/manage/bookings/${booking.id}/receipt`}
        />
      }
    >
      {booking.suiteId === null && (
        <ConsoleNotice tone="warning" Icon={TriangleAlertIcon} role="alert">
          No suite is secured for this booking. Change its suite, or refund the guest from Payments.
        </ConsoleNotice>
      )}

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-3">
        <BookingVisitSection
          booking={booking}
          createdByName={ledger.ok ? ledger.ledger.createdByName : null}
          className="xl:col-span-2"
        />

        <BookingSummaryCard
          rows={rows}
          isComplimentary={booking.isComplimentary}
          money={money}
          moneyError={ledger.ok ? "" : ledger.message}
          paymentCount={payments.ok ? payments.payments.length : null}
          statusLabel={bookingStatusLabel(displayStatus)}
        />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <BookingCustomerSection booking={booking} />
        <BookingNotesSection
          personalRequest={booking.personalRequest}
          internalNote={booking.internalNote}
          action={
            <BookingNotesEditAction
              bookingId={booking.id}
              who={booking.guestName || booking.reference}
              personalRequest={booking.personalRequest}
              internalNote={booking.internalNote}
              personalRequestMaxLength={requireSetting(snapshot, "booking.personal_request_max_length")}
            />
          }
        />
      </div>

      <DetailTabs
        label="Booking records"
        tabs={[
          {
            value: "payments",
            label: "Payments",
            count: payments.ok ? payments.payments.length : undefined,
            content: (
              <BookingPaymentsSection
                bookingId={booking.id}
                payments={payments}
                canWithdrawReceipt={booking.source === "online"}
              />
            ),
          },
          {
            value: "refunds",
            label: "Refunds",
            count: refunds.ok ? refunds.refunds.length : undefined,
            content: <BookingRefundsSection bookingId={booking.id} reference={booking.reference} refunds={refunds} />,
          },
          {
            value: "documents",
            label: "Invoices",
            count: documents.ok ? documents.total : undefined,
            content: (
              <BookingInvoicesSection
                documents={documents}
                action={
                  missingInvoice ? (
                    <IssueInvoiceButton bookingId={booking.id} />
                  ) : missingCheckFailed ? (
                    <span className="text-console-table text-text-secondary">
                      Could not check whether an invoice is missing. Reload the page to try again.
                    </span>
                  ) : undefined
                }
              />
            ),
          },
          {
            value: "messages",
            label: "Messages",
            count: messages.ok ? messages.messages.length : undefined,
            content: <BookingMessagesSection messages={messages} />,
          },
          {
            value: "history",
            label: "History",
            count: history.ok ? history.events.length : undefined,
            content: <BookingHistorySection history={history} />,
          },
        ]}
      />
    </ConsolePage>
  );
}
