import { CalendarDaysIcon } from "lucide-react";

import { resolveDisplayStatus } from "@/components/console/manage/bookings/booking-model";
import {
  BOOKING_STATUS_TONE,
  bookingHref,
  formatVisitDay,
  formatVisitTimes,
  suiteLabel,
} from "@/components/console/manage/customers/customer-view";
import { BOOKING_STATUS_LABEL } from "@/components/console/reception/booking-filters";
import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { ConsolePagination } from "@/components/console/shared/console-pagination";
import { DetailSection } from "@/components/console/shared/detail-section";
import { EmptyValue } from "@/components/console/shared/empty-value";
import { MoneyValue } from "@/components/console/shared/money-value";
import { StatusChip } from "@/components/console/shared/status-chip";
import type { ManagementBookingRow } from "@/lib/db/queries/management-bookings";

const COLUMNS: readonly ConsoleColumn<ManagementBookingRow>[] = [
  {
    id: "suite",
    header: "Suite",
    cell: (row) => suiteLabel(row.suiteNumber) ?? <EmptyValue label="No suite assigned" />,
  },
  {
    id: "visit",
    header: "Visit",
    cell: (row) => (
      <span className="flex flex-col gap-0.5">
        <span>{formatVisitDay(row.startsAt)}</span>
        <span className="font-data text-micro tabular-nums text-text-secondary">
          {formatVisitTimes(row.startsAt, row.endsAt)}
        </span>
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <StatusChip tone={BOOKING_STATUS_TONE[resolveDisplayStatus(row.status, row.displayStatus)]}>{BOOKING_STATUS_LABEL[resolveDisplayStatus(row.status, row.displayStatus)]}</StatusChip>
        {row.isComplimentary && <StatusChip tone="info">Complimentary</StatusChip>}
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

export interface CustomerBookingsTableProps {
  rows: readonly ManagementBookingRow[];
  page: number;
  pageSize: number;
  total: number;
  hrefForPage: (page: number) => string;
}

export function CustomerBookingsTable({ rows, page, pageSize, total, hrefForPage }: CustomerBookingsTableProps) {
  return (
    <div id="customer-bookings" className="flex min-w-0 scroll-mt-20 flex-col gap-3">
      <DetailSection title="Bookings" Icon={CalendarDaysIcon} count={total} flush>
        <ConsoleDataTable
          label="This customer’s bookings"
          framed={false}
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => row.id}
          rowHref={(row) => bookingHref(row.id)}
          rowLabel={(row) => `Open booking ${row.reference}`}
          empty={{
            title: "No bookings yet",
            description: "Bookings made online or at Reception appear here.",
            Icon: CalendarDaysIcon,
          }}
        />
      </DetailSection>
      {rows.length > 0 && (
        <ConsolePagination
          page={page}
          pageSize={pageSize}
          total={total}
          hrefFor={hrefForPage}
          noun={{ one: "booking", other: "bookings" }}
        />
      )}
    </div>
  );
}
