import {
  ConsoleDataTable,
  type ConsoleColumn,
  type ConsoleTableEmpty,
  type ConsoleTableError,
  type ConsoleTablePagination,
  type ConsoleTableSort,
} from "@/components/console/shared/console-data-table";
import { MoneyValue } from "@/components/console/shared/money-value";
import { StatusChip } from "@/components/console/shared/status-chip";
import { BookingStatusChip } from "@/components/console/manage/bookings/booking-status-chip";
import { PaymentStatusChip } from "@/components/console/manage/bookings/payment-status-chip";
import {
  bookedViaLabel,
  compactDuration,
  resolveDisplayStatus,
  visitMinutes,
} from "@/components/console/manage/bookings/booking-model";
import type { ManagementBookingRow } from "@/lib/db/queries/management-bookings";
import { DUBAI_TIME_ZONE, formatDubaiTime } from "@/lib/domain/time";

const DUBAI_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

function dubaiDay(instant: string): string {
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? "" : DUBAI_DAY.format(date);
}

const SECONDARY = "block text-micro font-normal whitespace-nowrap text-text-secondary";

const COLUMNS: readonly ConsoleColumn<ManagementBookingRow>[] = [
  {
    id: "booking",
    header: "Booking",
    sortKey: "created",
    sortFirst: "desc",
    cell: (row) => (
      <>
        <span className="block font-data tabular-nums whitespace-nowrap">{row.reference}</span>
        <span className={SECONDARY}>
          {dubaiDay(row.createdAt)} · {bookedViaLabel(row.source, row.createdByName)}
        </span>
      </>
    ),
  },
  {
    id: "customer",
    header: "Customer",
    wrap: true,
    className: "min-w-44",
    cell: (row) => (
      <>
        <span className="block font-medium text-text-primary">{row.guestName || "Name not recorded"}</span>
        {row.guestEmail !== "" && (
          <span className="block text-micro break-words text-text-secondary">{row.guestEmail}</span>
        )}
      </>
    ),
  },
  {
    id: "visit",
    header: "Visit",
    sortKey: "visit",
    sortFirst: "asc",
    cell: (row) => (
      <>
        <span className="block whitespace-nowrap">{dubaiDay(row.startsAt)}</span>
        <span className={`${SECONDARY} font-data tabular-nums`}>
          {formatDubaiTime(row.startsAt)}–{formatDubaiTime(row.endsAt)} ·{" "}
          {compactDuration(visitMinutes(row.startsAt, row.endsAt))}
        </span>
      </>
    ),
  },
  {
    id: "suite",
    header: "Suite",
    cell: (row) =>
      row.suiteNumber === null ? (
        <span className="whitespace-nowrap text-text-muted">No suite</span>
      ) : (
        <span className="font-data tabular-nums whitespace-nowrap">Suite {row.suiteNumber}</span>
      ),
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => (
      <span className="flex items-center gap-1.5">
        <BookingStatusChip status={resolveDisplayStatus(row.status, row.displayStatus)} />
        {row.isComplimentary ? (
          <StatusChip tone="brand">Complimentary</StatusChip>
        ) : (
          <PaymentStatusChip status={row.paymentStatus} />
        )}
      </span>
    ),
  },
  {
    id: "total",
    header: "Total",
    align: "end",
    cell: (row) => <MoneyValue fils={row.totalFils} />,
  },
];

export const BOOKINGS_TABLE_HEADERS: readonly string[] = COLUMNS.map((column) => column.header);

export interface BookingsTableProps {
  rows: readonly ManagementBookingRow[];
  sort: ConsoleTableSort;
  pagination: ConsoleTablePagination;
  empty: ConsoleTableEmpty;
  error: ConsoleTableError | null;
}

export function BookingsTable({ rows, sort, pagination, empty, error }: BookingsTableProps) {
  return (
    <ConsoleDataTable
      label="Bookings"
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.id}
      rowHref={(row) => `/manage/bookings/${row.id}`}
      rowLabel={(row) => `Open booking ${row.reference}`}
      sort={sort}
      pagination={pagination}
      empty={empty}
      error={error}
    />
  );
}
