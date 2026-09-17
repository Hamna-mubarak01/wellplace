import Link from "next/link";
import { BanknoteArrowDownIcon } from "lucide-react";

import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { MoneyValue } from "@/components/console/shared/money-value";
import { EmptyValue } from "@/components/console/shared/empty-value";
import { ReferenceValue } from "@/components/console/shared/reference-value";
import { StatusChip, type StatusChipTone } from "@/components/console/shared/status-chip";
import { WithdrawRefundDialog } from "@/components/console/reception/withdraw-refund-dialog";
import { Button } from "@/components/shared/button";
import type { BookingRefundListing, BookingRefundRecord } from "@/lib/db/queries/bookings-page";
import { formatDubaiDateTime } from "@/lib/domain/time";

export interface BookingRefundsSectionProps {
  bookingId: string;
  reference: string;
  refunds: BookingRefundListing;
}

type RefundState = "pending" | "returned" | "withdrawn";

function refundState(refund: BookingRefundRecord): RefundState {
  if (refund.withdrawnAt !== null) return "withdrawn";
  return refund.isPending ? "pending" : "returned";
}

const STATE_LABEL: Readonly<Record<RefundState, string>> = {
  pending: "Waiting to be returned",
  returned: "Returned",
  withdrawn: "Withdrawn",
};

const STATE_TONE: Readonly<Record<RefundState, StatusChipTone>> = {
  pending: "warning",
  returned: "success",
  withdrawn: "neutral",
};

const COLUMNS: readonly ConsoleColumn<BookingRefundRecord>[] = [
  {
    id: "reference",
    header: "Reference",
    wrap: true,
    cell: (refund) => <ReferenceValue reference={refund.reference} />,
  },
  {
    id: "requested",
    header: "Requested",
    cell: (refund) => <span className="whitespace-nowrap">{formatDubaiDateTime(refund.requestedAt)}</span>,
  },
  {
    id: "started",
    header: "Started",
    cell: (refund) => (refund.isAutomatic ? "Automatically" : "By staff"),
  },
  {
    id: "status",
    header: "Status",
    cell: (refund) => {
      const state = refundState(refund);
      return <StatusChip tone={STATE_TONE[state]}>{STATE_LABEL[state]}</StatusChip>;
    },
  },
  {
    id: "returned",
    header: "Returned on",
    cell: (refund) =>
      refund.settledAt === null ? (
        <EmptyValue label="Not returned yet" />
      ) : (
        <span className="whitespace-nowrap">{formatDubaiDateTime(refund.settledAt)}</span>
      ),
  },
  {
    id: "reason",
    header: "Reason",
    wrap: true,
    className: "min-w-44",
    cell: (refund) => (refund.reason ? refund.reason : <EmptyValue label="No reason recorded" />),
  },
  {
    id: "amount",
    header: "Amount",
    align: "end",
    cell: (refund) => <MoneyValue fils={refund.amountFils} />,
  },
];

export function BookingRefundsSection({ bookingId, reference, refunds }: BookingRefundsSectionProps) {
  const pendingAutomatic = refunds.ok && refunds.refunds.some((refund) => refundState(refund) === "pending" && refund.isAutomatic);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {pendingAutomatic && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={`/manage/finance/refunds?period=all&q=${encodeURIComponent(reference)}`}>
              Confirm returns in Refunds
            </Link>
          </Button>
        </div>
      )}
      <ConsoleDataTable
        label="Refunds for this booking"
        columns={COLUMNS}
        rows={refunds.ok ? refunds.refunds : []}
        rowKey={(refund) => refund.id}
        actionsHeader="Withdraw"
        actions={(refund) =>
          refundState(refund) === "pending" && !refund.isAutomatic ? (
            <WithdrawRefundDialog bookingId={bookingId} refundId={refund.id} amountFils={refund.amountFils} />
          ) : refundState(refund) === "pending" ? (
            <span className="text-micro text-text-secondary">Cannot be withdrawn</span>
          ) : null
        }
        error={refunds.ok ? null : { title: "Refunds could not be loaded", message: refunds.message }}
        empty={{
          title: "No refunds",
          description: "Refund a payment from the Payments tab.",
          Icon: BanknoteArrowDownIcon,
        }}
      />
    </div>
  );
}
