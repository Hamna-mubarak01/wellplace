import type { PaymentMethod, PaymentRow, PaymentStatus } from "@/lib/db/queries/payments";
import { formatDubaiDateTime } from "@/lib/domain/time";
import { formatAed } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { RefundDialog } from "@/components/console/reception/refund-dialog";
import { WithdrawRefundDialog } from "@/components/console/reception/withdraw-refund-dialog";
import { ReceiptIcon } from "lucide-react";
import { CONSOLE_ROW, ConsoleEmpty } from "@/components/console/console-surface";
import { ReferenceValue } from "@/components/console/shared/reference-value";

const METHOD_LABEL: Readonly<Record<PaymentMethod, string>> = {
  cash: "Cash",
  card_terminal: "Card terminal",
  payment_link: "Payment link",
  online: "Online",
  complimentary: "Complimentary",
};

const STATUS_LABEL: Readonly<Record<PaymentStatus, string>> = {
  open: "Open",
  pending: "Pending",
  paid: "Paid",
  partially_refunded: "Partially refunded",
  fully_refunded: "Fully refunded",
  failed: "Failed",
  cancelled: "Cancelled",
  manual_review: "Manual review",
};

const STATUS_CLASS: Readonly<Record<PaymentStatus, string>> = {
  open: "border-border-strong bg-surface-sunken text-text-secondary",
  pending: "border-warning-border bg-warning-wash text-warning-ink",
  paid: "border-success-border bg-success-wash text-success-ink",
  partially_refunded: "border-info-border bg-info-wash text-info-ink",
  fully_refunded: "border-info-border bg-info-wash text-info-ink",
  failed: "border-danger-border bg-danger-wash text-danger-ink",
  cancelled: "border-border-strong bg-surface-sunken text-text-secondary",
  manual_review: "border-danger-border bg-danger-wash text-danger-ink",
};

const REFUNDABLE: ReadonlySet<PaymentStatus> = new Set([
  "paid",
  "partially_refunded",
]);

export interface PaymentLogProps {
  bookingId: string;
  payments: readonly PaymentRow[];
  canSeeMoney: boolean;
  canRefund: boolean;
}

export function PaymentLog({
  bookingId,
  payments,
  canSeeMoney,
  canRefund,
}: PaymentLogProps) {
  if (payments.length === 0) {
    return (
      <ConsoleEmpty
        Icon={ReceiptIcon}
        title="No payments yet"
        description="Nothing has been paid against this booking yet."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {payments.map((payment) => (
        <li
          key={payment.id}
          className={CONSOLE_ROW}
        >
          <div className="min-w-0">
            <p className="font-data text-console-body tabular-nums text-text-primary">
              {canSeeMoney ? formatAed(payment.amountFils) : "Amount not shown"}
            </p>
            {canSeeMoney && (
              <ReferenceValue reference={payment.reference} secondary={payment.providerReference} />
            )}
            <p className="text-micro text-text-muted">
              {METHOD_LABEL[payment.method]} · {formatDubaiDateTime(payment.recordedAt)}
              {payment.recordedByName ? ` · ${payment.recordedByName}` : ""}
            </p>
            {payment.note && (
              <p className="mt-1 text-micro text-text-secondary">{payment.isSimulated ? "Simulation — no money charged" : payment.note}</p>
            )}
            {canSeeMoney && (payment.pendingRefunds ?? []).length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5" aria-label="Refunds waiting to be returned">
                {(payment.pendingRefunds ?? []).map((refund) => (
                  <li key={refund.id} className="flex flex-wrap items-center gap-2 text-micro text-warning-ink">
                    <span className="font-data tabular-nums">Refund pending · {formatAed(refund.amountFils)}</span>
                    <span className="text-text-muted">
                      {refund.automatic ? "started automatically" : "requested"} {formatDubaiDateTime(refund.requestedAt)}
                    </span>
                    {refund.automatic ? (
                      <span className="text-text-secondary">Management confirms the return in Payments and refunds.</span>
                    ) : canRefund ? (
                      <WithdrawRefundDialog bookingId={bookingId} refundId={refund.id} amountFils={refund.amountFils} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Badge
              variant="outline"
              className={`text-micro ${STATUS_CLASS[payment.status]}`}
            >
              {STATUS_LABEL[payment.status]}
            </Badge>

            {canRefund && canSeeMoney && REFUNDABLE.has(payment.status) && payment.refundableFils != null && payment.refundableFils > 0 && (
              <RefundDialog
                bookingId={bookingId}
                paymentId={payment.id}
                paymentAmountFils={payment.refundableFils}
                paymentLabel={`${METHOD_LABEL[payment.method]} · ${STATUS_LABEL[payment.status]}`}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
