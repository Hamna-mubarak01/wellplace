import { HistoryIcon } from "lucide-react";

import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { EmptyValue } from "@/components/console/shared/empty-value";
import { BOOKING_ACTIVITY_LABEL } from "@/lib/config/booking-list";
import { formatDubaiDateTime } from "@/lib/domain/time";
import type { Database } from "@/types/database.generated";

export type BookingHistoryEvent = Database["public"]["Functions"]["reception_booking_audit"]["Returns"][number];

export type BookingHistoryListing =
  | { ok: true; events: readonly BookingHistoryEvent[] }
  | { ok: false; message: string };

export interface BookingHistorySectionProps {
  history: BookingHistoryListing;
}

const COLUMNS: readonly ConsoleColumn<BookingHistoryEvent>[] = [
  {
    id: "when",
    header: "When",
    cell: (event) => (
      <time dateTime={event.occurred_at} className="whitespace-nowrap">
        {formatDubaiDateTime(event.occurred_at)}
      </time>
    ),
  },
  {
    id: "action",
    header: "What happened",
    wrap: true,
    cell: (event) => BOOKING_ACTIVITY_LABEL[event.action] ?? "Booking updated",
  },
  {
    id: "actor",
    header: "By",
    wrap: true,
    cell: (event) => event.actor_name || "System",
  },
  {
    id: "reason",
    header: "Reason",
    wrap: true,
    className: "min-w-52",
    cell: (event) =>
      event.reason ? (
        <span className="whitespace-pre-wrap wrap-anywhere">{event.reason}</span>
      ) : (
        <EmptyValue label="No reason recorded" />
      ),
  },
];

export function BookingHistorySection({ history }: BookingHistorySectionProps) {
  return (
    <ConsoleDataTable
      label="Booking history"
      columns={COLUMNS}
      rows={history.ok ? history.events : []}
      rowKey={(event) => String(event.event_id)}
      error={history.ok ? null : { title: "History could not be loaded", message: history.message }}
      empty={{
        title: "No recorded activity",
        description: "Changes to this booking, its payments and its messages appear here.",
        Icon: HistoryIcon,
      }}
    />
  );
}
