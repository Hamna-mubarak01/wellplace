import Link from "next/link";
import { CalendarCheckIcon } from "lucide-react";

import { ConsoleEmpty } from "@/components/console/console-surface";
import { resolveDisplayStatus } from "@/components/console/manage/bookings/booking-model";
import { BookingStatusChip } from "@/components/console/manage/bookings/booking-status-chip";
import { Button } from "@/components/shared/button";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import type { ManagementBookingRow } from "@/lib/db/queries/management-bookings";
import { formatDubaiTime } from "@/lib/domain/time";
import { formatDubaiMoment } from "@/app/(console)/manage/suites/suites-view";

export type SuiteBookingsResult =
  | { ok: true; upcoming: readonly ManagementBookingRow[]; earlier: readonly ManagementBookingRow[] }
  | { ok: false; message: string };

export interface SuiteBookingsProps {
  result: SuiteBookingsResult;
  now: Date;
  viewAllHref: string;
}

function BookingRow({ row, now }: { row: ManagementBookingRow; now: Date }) {
  return (
    <li>
      <Link
        href={`/manage/bookings/${row.id}`}
        className="flex min-h-tap items-center justify-between gap-3 px-5 py-2.5 outline-none transition-colors duration-150 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset motion-reduce:transition-none"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-console-table font-medium text-text-primary">{row.guestName || "Name not given"}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-data text-micro tabular-nums text-text-secondary">
            {formatDubaiMoment(row.startsAt, now)}–{formatDubaiTime(row.endsAt)}
          </span>
          <BookingStatusChip status={resolveDisplayStatus(row.status, row.displayStatus)} />
        </span>
      </Link>
    </li>
  );
}

function BookingGroup({
  id,
  title,
  rows,
  now,
}: {
  id: string;
  title: string;
  rows: readonly ManagementBookingRow[];
  now: Date;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-1">
      <h3 id={id} className="text-console-label tracking-label text-text-muted uppercase">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="py-2 text-console-body text-text-secondary">No upcoming bookings.</p>
      ) : (
        <ul className="-mx-5 flex flex-col divide-y divide-border border-y border-border">
          {rows.map((row) => (
            <BookingRow key={row.id} row={row} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ViewAll({ href }: { href: string }) {
  return (
    <div>
      <Button asChild variant="outline">
        <Link href={href}>View all bookings for this suite</Link>
      </Button>
    </div>
  );
}

export function SuiteBookings({ result, now, viewAllHref }: SuiteBookingsProps) {
  if (!result.ok) {
    return (
      <>
        <ConsoleReadError
          title="Bookings could not be loaded"
          message={result.message}
          remedy="Close the suite and open it again, or view all bookings for this suite."
        />
        <ViewAll href={viewAllHref} />
      </>
    );
  }

  if (result.upcoming.length === 0 && result.earlier.length === 0) {
    return (
      <ConsoleEmpty
        Icon={CalendarCheckIcon}
        title="No bookings yet"
        description="Bookings for this suite appear here as soon as they are made."
      />
    );
  }

  return (
    <>
      <BookingGroup id="suite-drawer-upcoming" title="Upcoming" rows={result.upcoming} now={now} />
      {result.earlier.length > 0 && (
        <BookingGroup id="suite-drawer-earlier" title="Earlier" rows={result.earlier} now={now} />
      )}
      <ViewAll href={viewAllHref} />
    </>
  );
}
