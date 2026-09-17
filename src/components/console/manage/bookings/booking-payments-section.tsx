import { WalletIcon } from "lucide-react";

import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { MoneyValue } from "@/components/console/shared/money-value";
import { EmptyValue } from "@/components/console/shared/empty-value";
import { ReferenceValue } from "@/components/console/shared/reference-value";
import { StatusChip } from "@/components/console/shared/status-chip";
import { RefundDialog } from "@/components/console/reception/refund-dialog";
import { RevokeReceiptDialog } from "@/components/console/reception/revoke-receipt-dialog";
import { PaymentStatusChip } from "@/components/console/manage/bookings/payment-status-chip";
import {
  PAYMENT_METHOD_LABEL,
  REFUNDABLE_PAYMENT,
  paymentStatusLabel,
} from "@/components/console/manage/bookings/booking-model";
import type { PaymentRow } from "@/lib/db/queries/payments";
import { formatDubaiDateTime } from "@/lib/domain/time";

export interface BookingPaymentsSectionProps {
  bookingId: string;
  payments: { ok: true; payments: readonly PaymentRow[] } | { ok: false; message: string };
  canWithdrawReceipt: boolean;
}

const COLUMNS: readonly ConsoleColumn<PaymentRow>[] = [
  {
    id: "recorded",
    header: "Recorded",
    cell: (payment) => (
      <>
        <span className="block whitespace-nowrap">{formatDubaiDateTime(payment.recordedAt)}</span>
        {payment.recordedByName && (
          <span className="block text-micro text-text-secondary">By {payment.recordedByName}</span>
        )}
      </>
    ),
  },
  {
    id: "method",
    header: "Method",
    wrap: true,
    cell: (payment) => (
      <>
        <span className="block">{PAYMENT_METHOD_LABEL[payment.method]}</span>
        {payment.isSimulated && <StatusChip tone="info">Simulation, no money charged</StatusChip>}
      </>
    ),
  },
  {
    id: "reference",
    header: "Reference",
    wrap: true,
    cell: (payment) => <ReferenceValue reference={payment.reference} secondary={payment.providerReference} />,
  },
  {
    id: "status",
    header: "Status",
    cell: (payment) => <PaymentStatusChip status={payment.status} />,
  },
  {
    id: "amount",
    header: "Amount",
    align: "end",
    cell: (payment) => <MoneyValue fils={payment.amountFils} />,
  },
  {
    id: "refundable",
    header: "Refundable",
    align: "end",
    cell: (payment) =>
      REFUNDABLE_PAYMENT.includes(payment.status) && payment.refundableFils != null ? (
        <MoneyValue fils={payment.refundableFils} />
      ) : (
        <EmptyValue label="Not refundable" />
      ),
  },
];

export function BookingPaymentsSection({ bookingId, payments, canWithdrawReceipt }: BookingPaymentsSectionProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {canWithdrawReceipt && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <RevokeReceiptDialog bookingId={bookingId} />
        </div>
      )}
      <ConsoleDataTable
        label="Payments for this booking"
        columns={COLUMNS}
        rows={payments.ok ? payments.payments : []}
        rowKey={(payment) => payment.id}
        actionsHeader="Refund"
        actions={(payment) =>
          REFUNDABLE_PAYMENT.includes(payment.status) &&
          payment.refundableFils != null &&
          payment.refundableFils > 0 ? (
            <RefundDialog
              bookingId={bookingId}
              paymentId={payment.id}
              paymentAmountFils={payment.refundableFils}
              paymentLabel={`${PAYMENT_METHOD_LABEL[payment.method]} · ${paymentStatusLabel(payment.status)}`}
            />
          ) : null
        }
        error={payments.ok ? null : { title: "Payments could not be loaded", message: payments.message }}
        empty={{
          title: "No payments yet",
          description: "Payments taken online or at the front desk appear here.",
          Icon: WalletIcon,
        }}
      />
    </div>
  );
}
