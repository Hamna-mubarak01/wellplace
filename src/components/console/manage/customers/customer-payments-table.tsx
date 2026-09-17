import { CreditCardIcon } from "lucide-react";

import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_TONE,
  bookingHref,
  formatDubaiDate,
} from "@/components/console/manage/customers/customer-view";
import { PAYMENT_STATUS_LABEL } from "@/components/console/reception/booking-filters";
import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { DetailSection } from "@/components/console/shared/detail-section";
import { MoneyValue } from "@/components/console/shared/money-value";
import { StatusChip } from "@/components/console/shared/status-chip";
import type { PaymentLedgerRow } from "@/lib/db/queries/management-payments";
import { formatDubaiTime } from "@/lib/domain/time";

const COLUMNS: readonly ConsoleColumn<PaymentLedgerRow>[] = [
  {
    id: "date",
    header: "Date",
    cell: (row) => (
      <span className="flex flex-col gap-0.5">
        <span>{formatDubaiDate(row.recordedAt)}</span>
        <span className="font-data text-micro tabular-nums text-text-secondary">{formatDubaiTime(row.recordedAt)}</span>
      </span>
    ),
  },
  {
    id: "booking",
    header: "Booking",
    cell: (row) => <span className="font-data tabular-nums">{row.bookingReference}</span>,
  },
  {
    id: "method",
    header: "Method",
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1.5">
        {PAYMENT_METHOD_LABEL[row.method]}
        {row.isSimulated && <StatusChip tone="neutral">Simulation</StatusChip>}
      </span>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    align: "end",
    cell: (row) => <MoneyValue fils={row.amountFils} />,
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => <StatusChip tone={PAYMENT_STATUS_TONE[row.status]}>{PAYMENT_STATUS_LABEL[row.status]}</StatusChip>,
  },
];

export interface CustomerPaymentsTableProps {
  rows: readonly PaymentLedgerRow[];
  total: number;
}

export function CustomerPaymentsTable({ rows, total }: CustomerPaymentsTableProps) {
  const truncated = total > rows.length;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <DetailSection title="Payments" Icon={CreditCardIcon} count={total} flush>
        <ConsoleDataTable
          label="Payments on this customer’s bookings"
          framed={false}
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => row.id}
          rowHref={(row) => bookingHref(row.bookingId)}
          rowLabel={(row) => `Open booking ${row.bookingReference}`}
          empty={{
            title: "No payments yet",
            description: "Payments appear here once they are taken online or recorded at Reception.",
            Icon: CreditCardIcon,
          }}
        />
      </DetailSection>
      {truncated && (
        <p className="text-console-table text-text-secondary">
          {`Showing the latest ${rows.length.toLocaleString("en-AE")} of ${total.toLocaleString("en-AE")} payments.`}
        </p>
      )}
    </div>
  );
}
